import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import CompanyFactory, SetorFactory, UserFactory
from apps.vagas.models import EtapaKanban, Vaga


class EtapaKanbanFactory(DjangoModelFactory):
    class Meta:
        model = EtapaKanban

    company = factory.SubFactory(CompanyFactory)
    nome = factory.Sequence(lambda n: f"Etapa {n}")
    ordem = factory.Sequence(lambda n: n)
    is_saida_negativa = False


class VagaFactory(DjangoModelFactory):
    class Meta:
        model = Vaga

    company = factory.SubFactory(CompanyFactory)
    titulo = factory.Sequence(lambda n: f"Vaga {n}")
    descricao = "Descrição da vaga"
    requisitos = "Requisitos da vaga"
    quantidade_vagas = 1
    setor = factory.SubFactory(SetorFactory)
    criado_por = factory.SubFactory(UserFactory)
