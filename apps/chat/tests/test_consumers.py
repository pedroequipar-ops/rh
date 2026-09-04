import pytest
from asgiref.sync import sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.accounts.tests.factories import CompanyFactory, SetorFactory, UserFactory
from apps.candidatos.tests.factories import CandidatoFactory
from apps.chat.middleware import JWTAuthMiddlewareStack
from apps.chat.models import ChatMensagem
from apps.chat.routing import websocket_urlpatterns

application = JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))


def _ws_path(candidato_id, user, company_id):
    token = str(AccessToken.for_user(user))
    return f"/ws/v1/chat/candidato/{candidato_id}/?token={token}&company_id={company_id}"


def _setup_candidato_com_setor():
    company = CompanyFactory()
    setor = SetorFactory(company=company)
    candidato = CandidatoFactory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()
    return company, setor, candidato


@sync_to_async
def _setup_rh():
    company, setor, candidato = _setup_candidato_com_setor()
    rh = UserFactory(company=company, role=User.Role.RH)
    return company, candidato, rh


@sync_to_async
def _setup_setor_dono():
    company, setor, candidato = _setup_candidato_com_setor()
    setor_user = UserFactory(company=company, role=User.Role.SETOR, setor=setor)
    return company, candidato, setor_user


@sync_to_async
def _setup_setor_alheio():
    company = CompanyFactory()
    setor_dono = SetorFactory(company=company)
    outro_setor = SetorFactory(company=company)
    candidato = CandidatoFactory(company=company)
    candidato.vaga.setor = setor_dono
    candidato.vaga.save()
    outro_setor_user = UserFactory(company=company, role=User.Role.SETOR, setor=outro_setor)
    return company, candidato, outro_setor_user


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_conexao_aceita_para_rh():
    company, candidato, rh = await _setup_rh()

    communicator = WebsocketCommunicator(application, _ws_path(candidato.id, rh, company.id))
    connected, _ = await communicator.connect()
    assert connected
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_conexao_aceita_para_setor_dono():
    company, candidato, setor_user = await _setup_setor_dono()

    communicator = WebsocketCommunicator(
        application, _ws_path(candidato.id, setor_user, company.id)
    )
    connected, _ = await communicator.connect()
    assert connected
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_conexao_rejeitada_para_setor_de_outro_setor():
    company, candidato, outro_setor_user = await _setup_setor_alheio()

    communicator = WebsocketCommunicator(
        application, _ws_path(candidato.id, outro_setor_user, company.id)
    )
    connected, close_code = await communicator.connect()
    assert connected is False
    assert close_code == 4403


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_mensagem_enviada_e_persistida_e_retransmitida():
    company, candidato, rh = await _setup_rh()

    communicator = WebsocketCommunicator(application, _ws_path(candidato.id, rh, company.id))
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"texto": "Olá, tudo bem?"})
    response = await communicator.receive_json_from()

    assert response["texto"] == "Olá, tudo bem?"
    assert response["candidato_id"] == str(candidato.id)

    exists = await sync_to_async(
        ChatMensagem.objects.filter(candidato=candidato, texto="Olá, tudo bem?").exists
    )()
    assert exists

    await communicator.disconnect()
