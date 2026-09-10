from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.vagas.models import Vaga


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_dashboard_resumo_e_status_batem_com_as_vagas(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    ontem = timezone.localdate() - timedelta(days=1)

    vaga_factory(company=company, setor=setor, status=Vaga.Status.SOLICITADA)
    vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA)
    vaga_factory(
        company=company, setor=setor, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=ontem
    )
    vaga_factory(company=company, setor=setor, status=Vaga.Status.PREENCHIDA)

    client = _client_for(rh, company)
    response = client.get("/v1/dashboard/")

    assert response.status_code == 200
    assert response.data["resumo"]["ativas"] == 3
    assert response.data["resumo"]["aguardando_aprovacao"] == 1
    assert response.data["resumo"]["preenchidas"] == 1
    assert response.data["resumo"]["atrasadas"] == 1

    por_status = {row["status"]: row["total"] for row in response.data["vagas_por_status"]}
    assert por_status["SOLICITADA"] == 1
    assert por_status["PUBLICADA"] == 2
    assert por_status["PREENCHIDA"] == 1


@pytest.mark.django_db
def test_dashboard_funil_etapas_conta_candidatos_ativos(
    company_factory, setor_factory, vaga_factory, etapa_factory, candidato_factory, user_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)
    etapa = etapa_factory(company=company, nome="Triagem", ordem=1)
    candidato_factory(vaga=vaga, etapa_atual=etapa)
    candidato_factory(vaga=vaga, etapa_atual=etapa)
    reprovado = candidato_factory(vaga=vaga, etapa_atual=etapa)
    reprovado.active = False
    reprovado.save(update_fields=["active"])

    client = _client_for(rh, company)
    response = client.get("/v1/dashboard/")

    funil = {row["etapa_id"]: row["total"] for row in response.data["funil_etapas"]}
    assert funil[str(etapa.id)] == 2


@pytest.mark.django_db
def test_dashboard_isola_por_empresa(company_factory, setor_factory, user_factory, vaga_factory):
    outra_empresa = company_factory()
    outro_setor = setor_factory(company=outra_empresa)
    vaga_factory(company=outra_empresa, setor=outro_setor, status=Vaga.Status.SOLICITADA)

    minha_empresa = company_factory()
    rh = user_factory(company=minha_empresa, role=User.Role.RH)

    client = _client_for(rh, minha_empresa)
    response = client.get("/v1/dashboard/")

    assert response.data["resumo"]["aguardando_aprovacao"] == 0


@pytest.mark.django_db
def test_dashboard_setor_e_escopado_ao_proprio_setor_mesmo_pedindo_outro(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_a = setor_factory(company=company)
    setor_b = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor_a)
    vaga_factory(company=company, setor=setor_a, status=Vaga.Status.SOLICITADA)
    vaga_factory(company=company, setor=setor_b, status=Vaga.Status.SOLICITADA)

    client = _client_for(setor_user, company)
    response = client.get("/v1/dashboard/", {"setor": str(setor_b.id)})

    assert response.data["resumo"]["aguardando_aprovacao"] == 1
