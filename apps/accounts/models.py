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

    def clean(self):
        super().clean()
        if self.role == self.Role.SETOR and not self.setor_id:
            raise ValidationError({"setor": "Obrigatório quando role=SETOR."})

    def __str__(self):
        return self.username
