import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import UserFactory
from apps.candidatos.tests.factories import CandidatoFactory
from apps.chat.models import ChatMensagem


class ChatMensagemFactory(DjangoModelFactory):
    class Meta:
        model = ChatMensagem

    company = factory.SelfAttribute("candidato.company")
    candidato = factory.SubFactory(CandidatoFactory)
    autor = factory.SubFactory(UserFactory)
    texto = factory.Sequence(lambda n: f"Mensagem {n}")
