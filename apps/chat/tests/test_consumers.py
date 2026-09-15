from unittest.mock import patch

import pytest
from asgiref.sync import sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.accounts.tests.factories import CompanyFactory, SetorFactory, UserFactory
from apps.candidatos.tests.factories import CandidatoFactory
from apps.chat.middleware import JWTAuthMiddlewareStack
from apps.chat.models import ChatMensagem
from apps.chat.routing import websocket_urlpatterns
from apps.vagas.tests.factories import VagaFactory

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


def _vaga_ws_path(vaga_id, user, company_id):
    token = str(AccessToken.for_user(user))
    return f"/ws/v1/chat/vaga/{vaga_id}/?token={token}&company_id={company_id}"


@sync_to_async
def _setup_vaga_rh():
    company = CompanyFactory()
    setor = SetorFactory(company=company)
    vaga = VagaFactory(company=company, setor=setor)
    rh = UserFactory(company=company, role=User.Role.RH)
    return company, vaga, rh


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_chat_vaga_conecta_e_persiste_mensagem():
    company, vaga, rh = await _setup_vaga_rh()

    communicator = WebsocketCommunicator(application, _vaga_ws_path(vaga.id, rh, company.id))
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"texto": "Vaga aprovada, pode publicar"})
    response = await communicator.receive_json_from()

    assert response["texto"] == "Vaga aprovada, pode publicar"
    assert response["vaga_id"] == str(vaga.id)

    exists = await sync_to_async(
        ChatMensagem.objects.filter(vaga=vaga, texto="Vaga aprovada, pode publicar").exists
    )()
    assert exists

    await communicator.disconnect()


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


@sync_to_async
def _setup_vaga_com_responsavel():
    company = CompanyFactory()
    setor = SetorFactory(company=company)
    responsavel = UserFactory(
        company=company, telefone="98988255192", whatsapp_confirmado_em=timezone.now()
    )
    vaga = VagaFactory(company=company, setor=setor, responsavel=responsavel)
    rh = UserFactory(company=company, role=User.Role.RH)
    return company, vaga, rh, responsavel


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
@patch("apps.chat.consumers.notificar_whatsapp")
async def test_mensagem_de_chat_notifica_responsavel(mock_notificar):
    company, vaga, rh, responsavel = await _setup_vaga_com_responsavel()

    communicator = WebsocketCommunicator(application, _vaga_ws_path(vaga.id, rh, company.id))
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"texto": "Entrevista marcada"})
    await communicator.receive_json_from()
    await communicator.disconnect()

    mock_notificar.assert_called_once()
    args, kwargs = mock_notificar.call_args
    assert args[0].id == responsavel.id
    assert kwargs["texto"] == "Entrevista marcada"


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
@patch("apps.chat.consumers.notificar_whatsapp")
async def test_mensagem_de_chat_nao_notifica_quando_autor_e_o_responsavel(mock_notificar):
    company, vaga, _rh, responsavel = await _setup_vaga_com_responsavel()

    communicator = WebsocketCommunicator(
        application, _vaga_ws_path(vaga.id, responsavel, company.id)
    )
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"texto": "Publiquei a vaga"})
    await communicator.receive_json_from()
    await communicator.disconnect()

    mock_notificar.assert_not_called()
