from unittest.mock import patch

import pytest
from django.utils import timezone

from apps.atividade import services
from apps.atividade.models import Atividade


@pytest.mark.django_db
@patch("apps.atividade.services.notificar_whatsapp")
def test_registrar_notifica_responsavel_da_vaga(mock_notificar, company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    responsavel = user_factory(
        company=company, telefone="98988255192", whatsapp_confirmado_em=timezone.now()
    )
    ator = user_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, responsavel=responsavel)

    services.registrar(ator, "aprovou", vaga, resumo="APROVADA")

    assert Atividade.objects.filter(alvo_id=vaga.id, resumo="APROVADA").exists()
    mock_notificar.assert_called_once()
    _, kwargs = mock_notificar.call_args
    assert kwargs["alvo_tipo"] == "vaga"
    assert kwargs["texto"] == "APROVADA"


@pytest.mark.django_db
@patch("apps.atividade.services.notificar_whatsapp")
def test_registrar_nao_notifica_quando_ator_e_o_proprio_responsavel(
    mock_notificar, company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    responsavel = user_factory(
        company=company, telefone="98988255192", whatsapp_confirmado_em=timezone.now()
    )
    vaga = vaga_factory(company=company, setor=setor, responsavel=responsavel)

    services.registrar(responsavel, "editou", vaga, resumo="editou a vaga")

    mock_notificar.assert_not_called()


@pytest.mark.django_db
@patch("apps.atividade.services.notificar_whatsapp")
def test_registrar_sem_responsavel_nao_notifica(
    mock_notificar, company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    ator = user_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, responsavel=None)

    services.registrar(ator, "editou", vaga, resumo="editou a vaga")

    mock_notificar.assert_not_called()
