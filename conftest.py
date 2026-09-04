import pytest

from apps.accounts.tests.factories import CompanyFactory, SetorFactory, UserFactory
from apps.candidatos.tests.factories import CandidatoFactory
from apps.chat.tests.factories import ChatMensagemFactory
from apps.vagas.tests.factories import EtapaKanbanFactory, VagaFactory


@pytest.fixture
def company_factory():
    return CompanyFactory


@pytest.fixture
def setor_factory():
    return SetorFactory


@pytest.fixture
def user_factory():
    return UserFactory


@pytest.fixture
def etapa_factory():
    return EtapaKanbanFactory


@pytest.fixture
def vaga_factory():
    return VagaFactory


@pytest.fixture
def candidato_factory():
    return CandidatoFactory


@pytest.fixture
def chat_mensagem_factory():
    return ChatMensagemFactory
