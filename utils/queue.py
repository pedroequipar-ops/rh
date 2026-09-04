import json
import time

import pika
from django.conf import settings


class QueueEngine:
    MAX_RETRIES = 3

    def publish(self, queue: str, payload: dict):
        for attempt in range(self.MAX_RETRIES):
            try:
                conn = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
                ch = conn.channel()
                ch.queue_declare(queue=queue, durable=True)
                ch.basic_publish(
                    exchange="",
                    routing_key=queue,
                    body=json.dumps(payload),
                    properties=pika.BasicProperties(delivery_mode=2),
                )
                conn.close()
                return
            except Exception:
                if attempt == self.MAX_RETRIES - 1:
                    raise
                time.sleep(2**attempt)
