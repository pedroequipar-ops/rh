from django.core.management.base import BaseCommand

from apps.vagas import services


class Command(BaseCommand):
    help = (
        "Notifica o RH sobre vagas ativas cujo prazo de preenchimento ou de "
        "início previsto já passou. Feito para rodar por cron do SO."
    )

    def handle(self, *args, **options):
        total = services.alertar_vagas_com_prazo_estourado()
        self.stdout.write(self.style.SUCCESS(f"{total} vaga(s) alertada(s)."))
