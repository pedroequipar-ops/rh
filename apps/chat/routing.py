from django.urls import path

from .consumers import ChatConsumer

websocket_urlpatterns = [
    path("ws/v1/chat/candidato/<uuid:candidato_id>/", ChatConsumer.as_asgi()),
]
