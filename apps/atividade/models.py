from django.conf import settings
from django.db import models

from apps.accounts.models import Company
from apps.core.models import TimeStampedModel


class AlvoTipo(models.TextChoices):
    VAGA = "VAGA", "Vaga"
    CANDIDATO = "CANDIDATO", "Candidato"


class Atividade(TimeStampedModel):
    """Feed append-only: uma linha por ação relevante em vaga/candidato."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="atividades")
    ator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="atividades",
        null=True,
        blank=True,
    )
    verbo = models.CharField(max_length=50)
    alvo_tipo = models.CharField(max_length=20, choices=AlvoTipo.choices)
    alvo_id = models.UUIDField()
    resumo = models.CharField(max_length=255)
    dados = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "alvo_tipo", "alvo_id"])]


class Comentario(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="comentarios")
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comentarios"
    )
    alvo_tipo = models.CharField(max_length=20, choices=AlvoTipo.choices)
    alvo_id = models.UUIDField()
    texto = models.TextField()
    mencoes = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="comentarios_mencionado"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "alvo_tipo", "alvo_id"])]
