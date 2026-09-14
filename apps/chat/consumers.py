from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.candidatos.models import Candidato
from apps.candidatos.services import can_access_candidato
from apps.vagas.models import Vaga
from apps.vagas.services import can_access_vaga

from .models import ChatMensagem


class _ChatConsumerBase(AsyncJsonWebsocketConsumer):
    """Base do chat em tempo real. Subclasses definem ``campo`` ("candidato" ou
    "vaga"), como carregar o objeto e como checar o acesso."""

    campo = None

    async def connect(self):
        user = self.scope["user"]
        company_id = self.scope.get("company_id")
        obj_id = self.scope["url_route"]["kwargs"][f"{self.campo}_id"]

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        obj = await self._get_obj(obj_id, company_id)
        if obj is None:
            await self.close(code=4403)
            return

        allowed = await database_sync_to_async(self._can_access)(user, obj)
        if not allowed:
            await self.close(code=4403)
            return

        self.obj = obj
        self.group_name = f"chat_{self.campo}_{obj_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        texto = (content or {}).get("texto", "").strip()
        if not texto:
            return

        mensagem = await self._criar_mensagem(texto)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "id": str(mensagem.id),
                f"{self.campo}_id": str(self.obj.id),
                "autor": self.scope["user"].username,
                "autor_id": str(self.scope["user"].id),
                "texto": mensagem.texto,
                "created_at": mensagem.created_at.isoformat(),
            },
        )

    async def chat_message(self, event):
        await self.send_json(event)

    @database_sync_to_async
    def _criar_mensagem(self, texto):
        return ChatMensagem.objects.create(
            company_id=self.obj.company_id,
            autor=self.scope["user"],
            texto=texto,
            **{self.campo: self.obj},
        )


class ChatConsumer(_ChatConsumerBase):
    campo = "candidato"

    @staticmethod
    def _can_access(user, obj):
        return can_access_candidato(user, obj)

    @database_sync_to_async
    def _get_obj(self, obj_id, company_id):
        try:
            return Candidato.objects.select_related("vaga").get(
                id=obj_id, company_id=company_id
            )
        except Candidato.DoesNotExist:
            return None


class VagaChatConsumer(_ChatConsumerBase):
    campo = "vaga"

    @staticmethod
    def _can_access(user, obj):
        return can_access_vaga(user, obj)

    @database_sync_to_async
    def _get_obj(self, obj_id, company_id):
        try:
            return Vaga.objects.select_related("setor").get(id=obj_id, company_id=company_id)
        except Vaga.DoesNotExist:
            return None


class NotificacoesConsumer(AsyncJsonWebsocketConsumer):
    """Canal único por usuário — recebe os eventos publicados por
    ``apps.core.notificacoes_ws.publicar_notificacao`` (notificação de
    candidato/vaga criada). Sem lógica de negócio aqui, só entrega."""

    async def connect(self):
        user = self.scope["user"]
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group_name = f"notificacoes_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def notificacao_evento(self, event):
        await self.send_json(event["payload"])
