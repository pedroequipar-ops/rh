from django.conf import settings
from django.db import models

from apps.accounts.models import Company
from apps.candidatos.models import Candidato
from apps.core.models import TimeStampedModel


class ChatMensagem(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="chat_mensagens")
    candidato = models.ForeignKey(Candidato, on_delete=models.CASCADE, related_name="mensagens")
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="mensagens_enviadas"
    )
    texto = models.TextField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.autor_id}: {self.texto[:30]}"
