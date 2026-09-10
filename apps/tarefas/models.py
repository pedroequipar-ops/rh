from django.conf import settings
from django.db import models

from apps.accounts.models import Company
from apps.atividade.models import AlvoTipo
from apps.core.models import TimeStampedModel


class Tarefa(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="tarefas")
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    due_at = models.DateTimeField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="tarefas",
        null=True,
        blank=True,
    )
    alvo_tipo = models.CharField(max_length=20, choices=AlvoTipo.choices, blank=True, default="")
    alvo_id = models.UUIDField(null=True, blank=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="tarefas_criadas"
    )
    # Carimbo do lembrete já disparado (evita notificar duas vezes) — mesmo
    # padrão de Vaga.prazo_alertado_em.
    lembrete_enviado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["due_at", "-created_at"]
        indexes = [models.Index(fields=["company", "alvo_tipo", "alvo_id"])]

    def __str__(self):
        return self.titulo
