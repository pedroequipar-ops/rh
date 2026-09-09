from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.candidatos.models import Candidato
from apps.candidatos.repositories.candidato_repository import CandidatoRepository
from apps.candidatos.services import can_access_candidato
from apps.vagas.models import Vaga
from apps.vagas.repositories.vaga_repository import VagaRepository
from apps.vagas.services import can_access_vaga
from utils.utils import capture_company_id

from .models import ChatLeitura, ChatMensagem
from .serializers import ChatMensagemSerializer, ChatNaoLidasResponseSerializer


def _marcar_como_lida(user, *, candidato=None, vaga=None):
    alvo = {"candidato": candidato} if candidato is not None else {"vaga": vaga}
    company_id = (candidato or vaga).company_id
    leitura, created = ChatLeitura.objects.get_or_create(
        usuario=user, defaults={"company_id": company_id}, **alvo
    )
    if not created:
        leitura.save(update_fields=["updated_at"])


def _get_candidato_ou_404(user, candidato_id, company_id):
    try:
        candidato = Candidato.objects.select_related("vaga").get(
            id=candidato_id, company_id=company_id
        )
    except Candidato.DoesNotExist as exc:
        raise NotFound() from exc
    if not can_access_candidato(user, candidato):
        raise NotFound()
    return candidato


def _get_vaga_ou_404(user, vaga_id, company_id):
    try:
        vaga = Vaga.objects.select_related("setor").get(id=vaga_id, company_id=company_id)
    except Vaga.DoesNotExist as exc:
        raise NotFound() from exc
    if not can_access_vaga(user, vaga):
        raise NotFound()
    return vaga


class _ChatMensagemListBase(generics.ListAPIView):
    queryset = ChatMensagem.objects.none()
    serializer_class = ChatMensagemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["created_at"]


class ChatMensagemListView(_ChatMensagemListBase):
    def get_queryset(self):
        company_id = capture_company_id(self.request)
        self.candidato = _get_candidato_ou_404(
            self.request.user, self.kwargs["candidato_id"], company_id
        )
        return ChatMensagem.objects.filter(candidato=self.candidato)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        _marcar_como_lida(request.user, candidato=self.candidato)
        return response


class VagaChatMensagemListView(_ChatMensagemListBase):
    def get_queryset(self):
        company_id = capture_company_id(self.request)
        self.vaga = _get_vaga_ou_404(self.request.user, self.kwargs["vaga_id"], company_id)
        return ChatMensagem.objects.filter(vaga=self.vaga)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        _marcar_como_lida(request.user, vaga=self.vaga)
        return response


class ChatMarcarLidaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, candidato_id):
        company_id = capture_company_id(request)
        candidato = _get_candidato_ou_404(request.user, candidato_id, company_id)
        _marcar_como_lida(request.user, candidato=candidato)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VagaChatMarcarLidaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, vaga_id):
        company_id = capture_company_id(request)
        vaga = _get_vaga_ou_404(request.user, vaga_id, company_id)
        _marcar_como_lida(request.user, vaga=vaga)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _nao_lidas(qs_objetos, leituras, campo, user, rotulo):
    resultado = []
    for obj in qs_objetos:
        mensagens = ChatMensagem.objects.filter(**{campo: obj}).exclude(autor=user)
        ultima_leitura = leituras.get(obj.id)
        if ultima_leitura:
            mensagens = mensagens.filter(created_at__gt=ultima_leitura)
        quantidade = mensagens.count()
        if quantidade:
            resultado.append(
                {
                    f"{campo}_id": obj.id,
                    f"{campo}_{rotulo}": getattr(obj, rotulo),
                    "quantidade": quantidade,
                }
            )
    return resultado


class ChatNaoLidasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        user = request.user

        crepo = CandidatoRepository()
        vrepo = VagaRepository()
        if user.role == "SETOR":
            candidatos = crepo.list_by_setor(company_id, user.setor_id)
            vagas = vrepo.list_by_setor(company_id, user.setor_id)
        else:
            candidatos = crepo.list_by_company(company_id)
            vagas = vrepo.list_by_company(company_id)

        leituras_cand = {
            leitura.candidato_id: leitura.updated_at
            for leitura in ChatLeitura.objects.filter(usuario=user, candidato__in=candidatos)
        }
        leituras_vaga = {
            leitura.vaga_id: leitura.updated_at
            for leitura in ChatLeitura.objects.filter(usuario=user, vaga__in=vagas)
        }

        candidatos_res = _nao_lidas(candidatos, leituras_cand, "candidato", user, "nome")
        vagas_res = _nao_lidas(vagas, leituras_vaga, "vaga", user, "titulo")

        data = {
            "total": sum(item["quantidade"] for item in candidatos_res + vagas_res),
            "candidatos": candidatos_res,
            "vagas": vagas_res,
        }
        return Response(ChatNaoLidasResponseSerializer(data).data)
