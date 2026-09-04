from django.contrib import admin

from .models import Candidato


@admin.register(Candidato)
class CandidatoAdmin(admin.ModelAdmin):
    list_display = ["id", "nome", "vaga", "company", "active"]
