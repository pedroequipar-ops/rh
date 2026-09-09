from django.urls import path

from .views import (
    ChatMarcarLidaView,
    ChatMensagemListView,
    ChatNaoLidasView,
    VagaChatMarcarLidaView,
    VagaChatMensagemListView,
)

urlpatterns = [
    path(
        "candidatos/<uuid:candidato_id>/mensagens/",
        ChatMensagemListView.as_view(),
        name="candidato-mensagens",
    ),
    path(
        "candidatos/<uuid:candidato_id>/mensagens/marcar-lida/",
        ChatMarcarLidaView.as_view(),
        name="candidato-mensagens-marcar-lida",
    ),
    path(
        "vagas/<uuid:vaga_id>/mensagens/",
        VagaChatMensagemListView.as_view(),
        name="vaga-mensagens",
    ),
    path(
        "vagas/<uuid:vaga_id>/mensagens/marcar-lida/",
        VagaChatMarcarLidaView.as_view(),
        name="vaga-mensagens-marcar-lida",
    ),
    path("chat/nao-lidas/", ChatNaoLidasView.as_view(), name="chat-nao-lidas"),
]
