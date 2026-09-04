from django.contrib import admin

from .models import ChatMensagem


@admin.register(ChatMensagem)
class ChatMensagemAdmin(admin.ModelAdmin):
    list_display = ["id", "candidato", "autor", "created_at"]
