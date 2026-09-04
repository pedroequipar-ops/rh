from django.urls import path

from .views import ChatMensagemListView

urlpatterns = [
    path(
        "candidatos/<uuid:candidato_id>/mensagens/",
        ChatMensagemListView.as_view(),
        name="candidato-mensagens",
    ),
]
