import json

import pika
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.logger import LoggerEngine

from ...models import User

log = LoggerEngine(__name__)


class Command(BaseCommand):
    help = (
        "Drena a fila QUEUE_WHATSAPP_CONFIRM (publicada pelo whatsapp-bot sempre que um "
        "telefone manda a primeira mensagem pro bot) e marca User.whatsapp_confirmado_em. "
        "Roda em loop curto (chamado a cada poucos segundos pelo entrypoint do worker) em "
        "vez de manter uma conexão AMQP viva — mesmo padrão de polling já usado por "
        "ingerir_emails_triagem, não introduz um segundo jeito de rodar worker no stack."
    )

    def handle(self, *args, **options):
        connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
        channel = connection.channel()
        channel.queue_declare(queue=settings.QUEUE_WHATSAPP_CONFIRM, durable=True)

        processadas = 0
        while True:
            method, _properties, body = channel.basic_get(
                queue=settings.QUEUE_WHATSAPP_CONFIRM, auto_ack=False
            )
            if method is None:
                break
            try:
                payload = json.loads(body)
                self._confirmar(payload["phone"])
                channel.basic_ack(delivery_tag=method.delivery_tag)
                processadas += 1
            except Exception:
                log.error("Falha ao processar confirmação de WhatsApp")
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        connection.close()
        if processadas:
            self.stdout.write(f"{processadas} confirmação(ões) de WhatsApp processada(s)")

    def _confirmar(self, phone: str):
        atualizadas = User.objects.filter(telefone=phone, whatsapp_confirmado_em__isnull=True).update(
            whatsapp_confirmado_em=timezone.now()
        )
        if atualizadas:
            log.info("Telefone confirmado pro WhatsApp", telefone=phone)
