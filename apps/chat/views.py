from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.candidatos.models import Candidato
from apps.candidatos.repositories.candidato_repository import CandidatoRepository
from apps.candidatos.services import can_access_candidato
from utils.utils import capture_company_id

from .models import ChatLeitura, ChatMensagem
from .serializers import ChatMensagemSerializer, ChatNaoLidasResponseSerializer


def _marcar_como_lida(user, candidato):
    leitura, created = ChatLeitura.objects.get_or_create(
        usuario=user, candidato=candidato, defaults={"company_id": candidato.company_id}
    )
    if not created:
        leitura.save(update_fields=["updated_at"])


class ChatMensagemListView(generics.ListAPIView):
    queryset = ChatMensagem.objects.none()
    serializer_class = ChatMensagemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["created_at"]

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        candidato_id = self.kwargs["candidato_id"]
        try:
            candidato = Candidato.objects.select_related("vaga").get(
                id=candidato_id, company_id=company_id
            )
        except Candidato.DoesNotExist as exc:
            raise NotFound() from exc

        if not can_access_candidato(self.request.user, candidato):
            raise NotFound()

        self.candidato = candidato
        return ChatMensagem.objects.filter(candidato=candidato)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        _marcar_como_lida(request.user, self.candidato)
        return response


class ChatMarcarLidaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, candidato_id):
        company_id = capture_company_id(request)
        try:
            candidato = Candidato.objects.get(id=candidato_id, company_id=company_id)
        except Candidato.DoesNotExist as exc:
            raise NotFound() from exc

        if not can_access_candidato(request.user, candidato):
            raise NotFound()

        _marcar_como_lida(request.user, candidato)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatNaoLidasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        user = request.user

        repo = CandidatoRepository()
        if user.role == "SETOR":
            candidatos = repo.list_by_setor(company_id, user.setor_id)
        else:
            candidatos = repo.list_by_company(company_id)

        leituras = {
            leitura.candidato_id: leitura.updated_at
            for leitura in ChatLeitura.objects.filter(usuario=user, candidato__in=candidatos)
        }

        resultado = []
        for candidato in candidatos:
            mensagens = ChatMensagem.objects.filter(candidato=candidato).exclude(autor=user)
            ultima_leitura = leituras.get(candidato.id)
            if ultima_leitura:
                mensagens = mensagens.filter(created_at__gt=ultima_leitura)
            quantidade = mensagens.count()
            if quantidade:
                resultado.append(
                    {
                        "candidato_id": candidato.id,
                        "candidato_nome": candidato.nome,
                        "quantidade": quantidade,
                    }
                )

        data = {
            "total": sum(item["quantidade"] for item in resultado),
            "candidatos": resultado,
        }
        return Response(ChatNaoLidasResponseSerializer(data).data)
