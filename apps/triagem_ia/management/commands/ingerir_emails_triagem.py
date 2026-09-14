from django.core.management.base import BaseCommand

from apps.triagem_ia import services


class Command(BaseCommand):
    help = (
        "Verifica cada caixa de e-mail ativa da Triagem por IA, ingere os "
        "e-mails não lidos e pontua os currículos contra a vaga roteada. "
        "Feito para rodar por cron do SO."
    )

    def handle(self, *args, **options):
        total = services.ingerir_todas_caixas()
        self.stdout.write(self.style.SUCCESS(f"{total} e-mail(s) processado(s)."))
