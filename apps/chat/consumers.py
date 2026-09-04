from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.candidatos.models import Candidato
from apps.candidatos.services import can_access_candidato

from .models import ChatMensagem


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        company_id = self.scope.get("company_id")
        candidato_id = self.scope["url_route"]["kwargs"]["candidato_id"]

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        candidato = await self._get_candidato(candidato_id, company_id)
        if candidato is None:
            await self.close(code=4403)
            return

        allowed = await database_sync_to_async(can_access_candidato)(user, candidato)
        if not allowed:
            await self.close(code=4403)
            return

        self.candidato = candidato
        self.group_name = f"chat_candidato_{candidato_id}"
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
                "candidato_id": str(self.candidato.id),
                "autor": self.scope["user"].username,
                "autor_id": str(self.scope["user"].id),
                "texto": mensagem.texto,
                "created_at": mensagem.created_at.isoformat(),
            },
        )

    async def chat_message(self, event):
        await self.send_json(event)

    @database_sync_to_async
    def _get_candidato(self, candidato_id, company_id):
        try:
            return Candidato.objects.select_related("vaga").get(
                id=candidato_id, company_id=company_id
            )
        except Candidato.DoesNotExist:
            return None

    @database_sync_to_async
    def _criar_mensagem(self, texto):
        return ChatMensagem.objects.create(
            company_id=self.candidato.company_id,
            candidato=self.candidato,
            autor=self.scope["user"],
            texto=texto,
        )
