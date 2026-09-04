from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.accounts.models import Company, Setor, User


class Command(BaseCommand):
    help = "Semeia dados de demonstração: company, setores, usuários RH/SETOR e etapas."

    def handle(self, *args, **options):
        company, _ = Company.objects.get_or_create(nome="Equipar Eventos")

        setor_rh, _ = Setor.objects.get_or_create(company=company, nome="RH")
        setor_financeiro, _ = Setor.objects.get_or_create(company=company, nome="Financeiro")
        setor_comercial, _ = Setor.objects.get_or_create(company=company, nome="Comercial")

        if not User.objects.filter(username="rh", company=company).exists():
            rh = User.objects.create_user(
                username="rh",
                password="rh12345",
                email="rh@equipar.local",
                role=User.Role.RH,
                company=company,
                setor=setor_rh,
                is_staff=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Usuário RH criado: {rh.username}"))

        if not User.objects.filter(username="financeiro", company=company).exists():
            setor_user = User.objects.create_user(
                username="financeiro",
                password="financeiro123",
                email="financeiro@equipar.local",
                role=User.Role.SETOR,
                company=company,
                setor=setor_financeiro,
            )
            self.stdout.write(self.style.SUCCESS(f"Usuário SETOR criado: {setor_user.username}"))

        if not User.objects.filter(username="comercial", company=company).exists():
            setor_user = User.objects.create_user(
                username="comercial",
                password="comercial123",
                email="comercial@equipar.local",
                role=User.Role.SETOR,
                company=company,
                setor=setor_comercial,
            )
            self.stdout.write(self.style.SUCCESS(f"Usuário SETOR criado: {setor_user.username}"))

        call_command("seed_etapas", company_id=str(company.id))

        self.stdout.write(
            self.style.SUCCESS(f"Dados de demonstração prontos. Company: {company.id}")
        )
