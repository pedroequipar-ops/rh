from django.core.management.base import BaseCommand

from apps.tarefas import services


class Command(BaseCommand):
    help = (
        "Notifica o responsável de cada tarefa pendente com prazo vencendo hoje "
        "ou já vencido. Feito para rodar por cron do SO."
    )

    def handle(self, *args, **options):
        total = services.rodar_lembretes()
        self.stdout.write(self.style.SUCCESS(f"{total} lembrete(s) enviado(s)."))
