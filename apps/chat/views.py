from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated

from apps.candidatos.models import Candidato
from apps.candidatos.services import can_access_candidato
from utils.utils import capture_company_id

from .models import ChatMensagem
from .serializers import ChatMensagemSerializer


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

        return ChatMensagem.objects.filter(candidato=candidato)
