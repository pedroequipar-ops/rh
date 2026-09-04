import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import UserFactory
from apps.candidatos.models import Candidato
from apps.vagas.tests.factories import EtapaKanbanFactory, VagaFactory


class CandidatoFactory(DjangoModelFactory):
    class Meta:
        model = Candidato

    company = factory.SelfAttribute("vaga.company")
    vaga = factory.SubFactory(VagaFactory)
    etapa_atual = factory.SubFactory(
        EtapaKanbanFactory, company=factory.SelfAttribute("..vaga.company")
    )
    nome = factory.Sequence(lambda n: f"Candidato {n}")
    email = factory.Sequence(lambda n: f"candidato{n}@example.com")
    telefone = "11999999999"
    cpf = "00000000000"
    linkedin_url = ""
    curriculo_key = factory.Sequence(lambda n: f"candidatos/curriculo-{n}.pdf")
    curriculo_content_type = "application/pdf"
    cadastrado_por = factory.SubFactory(UserFactory)
