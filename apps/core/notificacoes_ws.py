"""Publica eventos de notificação em tempo real via Channels.

Cada usuário tem seu próprio grupo (``notificacoes_<user_id>``), ao qual o
frontend se conecta uma única vez (ver ``apps/chat/notificacoes_consumer.py``).
Chamado logo depois de criar um ``CandidatoNotificacao``/``VagaNotificacao``,
nos mesmos pontos onde hoje já se faz o ``create``/``bulk_create`` — não há
signal automático porque ``bulk_create`` não dispara ``post_save``.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def publicar_notificacao(destinatario_id, tipo: str, payload: dict) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"notificacoes_{destinatario_id}",
        {"type": "notificacao.evento", "payload": {"tipo": tipo, **payload}},
    )
