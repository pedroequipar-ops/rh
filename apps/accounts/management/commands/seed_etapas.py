from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Company
from apps.vagas.models import EtapaKanban

ETAPAS_SEED = [
    ("Triagem", False),
    ("Primeira Entrevista", False),
    ("Perfil Comportamental", False),
    ("Prova Prática", False),
    ("Entrevista com Gestor", False),
    ("Contratado", False),
    ("Reprovado/Cancelada", True),
]


class Command(BaseCommand):
    help = "Semeia as etapas padrão do kanban de vagas para uma company."

    def add_arguments(self, parser):
        parser.add_argument("--company-id", dest="company_id", default=None)

    def handle(self, *args, **options):
        company_id = options["company_id"]
        if company_id:
            try:
                company = Company.objects.get(id=company_id)
            except Company.DoesNotExist as exc:
                raise CommandError(f"Company {company_id} não encontrada.") from exc
        else:
            company = Company.objects.first()
            if company is None:
                raise CommandError(
                    "Nenhuma company encontrada. Rode seed_demo_data primeiro ou "
                    "informe --company-id."
                )

        for ordem, (nome, is_saida_negativa) in enumerate(ETAPAS_SEED):
            EtapaKanban.objects.update_or_create(
                company=company,
                nome=nome,
                defaults={"ordem": ordem, "is_saida_negativa": is_saida_negativa},
            )

        self.stdout.write(self.style.SUCCESS(f"Etapas semeadas para company {company.id}."))
