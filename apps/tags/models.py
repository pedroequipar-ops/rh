from django.db import models

from apps.accounts.models import Company
from apps.core.models import TimeStampedModel


class Tag(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="tags")
    nome = models.CharField(max_length=60)
    cor = models.CharField(max_length=20, null=True, blank=True, default="")

    class Meta:
        ordering = ["nome"]
        unique_together = [["company", "nome"]]

    def __str__(self):
        return self.nome
