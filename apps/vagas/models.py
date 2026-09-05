from django.conf import settings
from django.db import models

from apps.accounts.models import Company, Setor
from apps.core.models import TimeStampedModel


class EtapaKanban(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="etapas")
    nome = models.CharField(max_length=100)
    ordem = models.PositiveIntegerField(default=0)
    is_saida_negativa = models.BooleanField(default=False)
    cor = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        ordering = ["ordem"]

    def __str__(self):
        return self.nome


class Vaga(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vagas")
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    requisitos = models.TextField(blank=True, default="")
    quantidade_vagas = models.PositiveIntegerField(default=1)
    salario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name="vagas")
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="vagas_criadas"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.titulo


class VagaNotificacao(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vaga_notificacoes")
    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vaga_notificacoes"
    )
    vaga = models.ForeignKey(Vaga, on_delete=models.CASCADE, related_name="notificacoes")
    mensagem = models.CharField(max_length=255)
    lida = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
