from django.urls import path

from .consumers import ChatConsumer, VagaChatConsumer

websocket_urlpatterns = [
    path("ws/v1/chat/candidato/<uuid:candidato_id>/", ChatConsumer.as_asgi()),
    path("ws/v1/chat/vaga/<uuid:vaga_id>/", VagaChatConsumer.as_asgi()),
]
