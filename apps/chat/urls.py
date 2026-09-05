from django.urls import path

from .views import ChatMarcarLidaView, ChatMensagemListView, ChatNaoLidasView

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
    path("chat/nao-lidas/", ChatNaoLidasView.as_view(), name="chat-nao-lidas"),
]
