from unittest.mock import patch

import pytest
from django.utils import timezone

from utils.whatsapp import notificar_whatsapp


@pytest.mark.django_db
@patch("utils.whatsapp.QueueEngine")
def test_nao_publica_sem_telefone(mock_queue, company_factory, user_factory):
    company = company_factory()
    usuario = user_factory(company=company, telefone="")

    notificar_whatsapp(usuario, alvo_tipo="vaga", alvo_id="123", titulo="X", texto="Y")

    mock_queue.return_value.publish.assert_not_called()


@pytest.mark.django_db
@patch("utils.whatsapp.QueueEngine")
def test_nao_publica_telefone_nao_confirmado(mock_queue, company_factory, user_factory):
    company = company_factory()
    usuario = user_factory(company=company, telefone="98988255192", whatsapp_confirmado_em=None)

    notificar_whatsapp(usuario, alvo_tipo="vaga", alvo_id="123", titulo="X", texto="Y")

    mock_queue.return_value.publish.assert_not_called()


@pytest.mark.django_db
@patch("utils.whatsapp.QueueEngine")
def test_publica_quando_telefone_confirmado(mock_queue, company_factory, user_factory):
    company = company_factory()
    usuario = user_factory(
        company=company, telefone="98988255192", whatsapp_confirmado_em=timezone.now()
    )

    notificar_whatsapp(
        usuario, alvo_tipo="vaga", alvo_id="abc-123", titulo="Nova mensagem", texto="oi", sender="rh"
    )

    mock_queue.return_value.publish.assert_called_once()
    fila, payload = mock_queue.return_value.publish.call_args[0]
    assert fila == "rh.whatsapp_notify"
    assert payload["recipients"] == ["98988255192"]
    assert payload["title"] == "Nova mensagem"
    assert payload["summary"] == "oi"
    assert payload["sender"] == "rh"
    assert "/rh/vagas/vaga/abc-123" in payload["link"]


@pytest.mark.django_db
@patch("utils.whatsapp.QueueEngine")
def test_nao_propaga_excecao_da_fila(mock_queue, company_factory, user_factory):
    company = company_factory()
    usuario = user_factory(
        company=company, telefone="98988255192", whatsapp_confirmado_em=timezone.now()
    )
    mock_queue.return_value.publish.side_effect = RuntimeError("rabbitmq fora do ar")

    notificar_whatsapp(usuario, alvo_tipo="candidato", alvo_id="1", titulo="X", texto="Y")
