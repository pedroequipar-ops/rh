from uuid import uuid4

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel


class Company(TimeStampedModel):
    nome = models.CharField(max_length=255)

    class Meta:
        verbose_name_plural = "companies"

    def __str__(self):
        return self.nome


class Setor(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="setores")
    nome = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "nome"],
                condition=models.Q(active=True),
                name="unique_setor_nome_por_company_ativo",
            )
        ]

    def __str__(self):
        return self.nome


class User(AbstractUser):
    class Role(models.TextChoices):
        RH = "RH", "RH"
        SETOR = "SETOR", "Setor"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="users")
    role = models.CharField(max_length=10, choices=Role.choices)
    setor = models.ForeignKey(
        Setor, on_delete=models.SET_NULL, related_name="users", null=True, blank=True
    )
    # DDD + número, só dígitos, sem código de país (padrão brasileiro sem o
    # 55 na frente) — mesmo formato que o whatsapp-bot espera (ver
    # utils/whatsapp.py). Opcional: nem todo usuário recebe aviso por
    # WhatsApp.
    telefone = models.CharField(max_length=15, blank=True)
    # Preenchido quando esse telefone manda a primeira mensagem pro bot —
    # sem isso, notificar_whatsapp() não manda nada pra ele (ver
    # apps/accounts/management/commands/consumir_confirmacoes_whatsapp.py).
    # Evita mandar mensagem não solicitada pra número que nunca interagiu
    # com o bot (risco de a sessão do WhatsApp ser sinalizada como spam).
    whatsapp_confirmado_em = models.DateTimeField(null=True, blank=True)

    def clean(self):
        super().clean()
        if self.role == self.Role.SETOR and not self.setor_id:
            raise ValidationError({"setor": "Obrigatório quando role=SETOR."})

    def __str__(self):
        return self.username
