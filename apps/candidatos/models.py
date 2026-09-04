from django.conf import settings
from django.db import models

from apps.accounts.models import Company
from apps.core.models import TimeStampedModel
from apps.vagas.models import EtapaKanban, Vaga


class Candidato(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="candidatos")
    vaga = models.ForeignKey(Vaga, on_delete=models.CASCADE, related_name="candidatos")
    etapa_atual = models.ForeignKey(
        EtapaKanban, on_delete=models.PROTECT, related_name="candidatos"
    )
    ordem = models.PositiveIntegerField(default=0)
    nome = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default="")
    telefone = models.CharField(max_length=30, blank=True, default="")
    cpf = models.CharField(max_length=20, blank=True, default="")
    linkedin_url = models.URLField(blank=True, default="")
    resumo_perfil = models.TextField(blank=True, default="")
    curriculo_key = models.CharField(max_length=500)
    curriculo_content_type = models.CharField(max_length=100, default="application/pdf")
    cadastrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="candidatos_cadastrados"
    )

    class Meta:
        ordering = ["ordem", "-created_at"]

    def __str__(self):
        return self.nome
