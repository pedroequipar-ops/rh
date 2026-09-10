import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import CompanyFactory, UserFactory
from apps.tarefas.models import Tarefa


class TarefaFactory(DjangoModelFactory):
    class Meta:
        model = Tarefa

    company = factory.SubFactory(CompanyFactory)
    titulo = factory.Sequence(lambda n: f"Tarefa {n}")
    criado_por = factory.SubFactory(UserFactory)
