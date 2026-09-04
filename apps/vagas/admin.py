from django.contrib import admin

from .models import EtapaKanban, Vaga


@admin.register(EtapaKanban)
class EtapaKanbanAdmin(admin.ModelAdmin):
    list_display = ["id", "nome", "ordem", "is_saida_negativa", "company", "active"]


@admin.register(Vaga)
class VagaAdmin(admin.ModelAdmin):
    list_display = ["id", "titulo", "setor", "company", "active"]
