from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidatos.interfaces.i_triagem_ia_extractor import (
    CandidatoPontuadoDTO,
    ITriagemIaExtractor,
)
from apps.triagem_ia.models import StatusTriagemIA


class FakeTriagemExtractorSucesso(ITriagemIaExtractor):
    def pontuar(self, texto_curriculo, vaga):
        return CandidatoPontuadoDTO(nome="Ana", email="ana@example.com", score=95, justificativa="Ótimo fit.")


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_setor_nao_pode_listar_triagem_ia(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.get(f"/v1/triagem-ia/?vaga_id={vaga.id}")

    assert response.status_code == 403


@pytest.mark.django_db
def test_rh_lista_triagem_ia_ordenada_por_score_com_destaque(
    company_factory, setor_factory, user_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    baixo = triagem_ia_factory(company=company, vaga=vaga, score=40)
    alto = triagem_ia_factory(company=company, vaga=vaga, score=95)

    client = _client_for(rh, company)
    response = client.get(f"/v1/triagem-ia/?vaga_id={vaga.id}")

    assert response.status_code == 200
    ids = [item["id"] for item in response.data]
    assert ids == [str(alto.id), str(baixo.id)]
    assert response.data[0]["destaque"] is True


@pytest.mark.django_db
def test_rh_lista_nao_roteados(company_factory, user_factory, triagem_ia_factory, vaga_factory, setor_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    nao_roteado = triagem_ia_factory(company=company, vaga=None, score=None)

    client = _client_for(rh, company)
    response = client.get("/v1/triagem-ia/?nao_roteado=true")

    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [str(nao_roteado.id)]


@pytest.mark.django_db
def test_rh_decide_trazer_pro_funil(
    company_factory, setor_factory, user_factory, etapa_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company, exige_cadastro_completo=True)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(company=company, vaga=vaga)

    client = _client_for(rh, company)
    response = client.post(f"/v1/triagem-ia/{triagem.id}/decidir/", {"acao": "funil"})

    assert response.status_code == 200
    assert response.data["vaga_id"] == str(vaga.id)


@pytest.mark.django_db
def test_setor_nao_pode_decidir_triagem_ia(
    company_factory, setor_factory, user_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    triagem = triagem_ia_factory(company=company, vaga=vaga)

    client = _client_for(setor_user, company)
    response = client.post(f"/v1/triagem-ia/{triagem.id}/decidir/", {"acao": "funil"})

    assert response.status_code == 403


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
@patch("apps.triagem_ia.services.candidatos_services.extrair_texto_anexo", return_value="texto")
@patch(
    "apps.triagem_ia.services.settings.TRIAGEM_IA_EXTRACTOR_CLASS",
    "apps.triagem_ia.tests.test_views.FakeTriagemExtractorSucesso",
)
def test_rh_roteia_email_nao_roteado_e_ia_pontua_na_hora(
    mock_extrair,
    mock_storage,
    company_factory,
    setor_factory,
    user_factory,
    vaga_factory,
    triagem_ia_factory,
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(company=company, vaga=None, score=None)

    client = _client_for(rh, company)
    response = client.post(f"/v1/triagem-ia/{triagem.id}/rotear/", {"vaga_id": str(vaga.id)})

    assert response.status_code == 200
    assert response.data["status"] == StatusTriagemIA.PRONTO
    assert response.data["score"] == 95


@pytest.mark.django_db
def test_rh_adiciona_caixa_de_entrada(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/triagem-ia-caixa-entrada/",
        {"host": "imap.gmail.com", "usuario": "vagas@empresa.com", "senha": "segredo123"},
    )

    assert response.status_code == 201
    assert "senha" not in response.data
    assert response.data["usuario"] == "vagas@empresa.com"


@pytest.mark.django_db
def test_rh_adiciona_varias_caixas_e_lista_todas(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    client.post(
        "/v1/triagem-ia-caixa-entrada/",
        {"host": "imap.gmail.com", "usuario": "vagas-ti@empresa.com", "senha": "segredo123"},
    )
    client.post(
        "/v1/triagem-ia-caixa-entrada/",
        {"host": "imap.gmail.com", "usuario": "vagas-rh@empresa.com", "senha": "segredo123"},
    )

    response = client.get("/v1/triagem-ia-caixa-entrada/")

    assert response.status_code == 200
    usuarios = {item["usuario"] for item in response.data}
    assert usuarios == {"vagas-ti@empresa.com", "vagas-rh@empresa.com"}


@pytest.mark.django_db
def test_rh_remove_uma_caixa_sem_afetar_as_outras(company_factory, user_factory, caixa_entrada_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    caixa_a = caixa_entrada_factory(company=company, usuario="a@empresa.com")
    caixa_b = caixa_entrada_factory(company=company, usuario="b@empresa.com")

    client = _client_for(rh, company)
    response = client.delete(f"/v1/triagem-ia-caixa-entrada/{caixa_a.id}/")

    assert response.status_code == 204
    response = client.get("/v1/triagem-ia-caixa-entrada/")
    assert [item["id"] for item in response.data] == [str(caixa_b.id)]


@pytest.mark.django_db
def test_setor_nao_pode_configurar_caixa_de_entrada(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.post(
        "/v1/triagem-ia-caixa-entrada/",
        {"host": "imap.gmail.com", "usuario": "vagas@empresa.com", "senha": "segredo123"},
    )

    assert response.status_code == 403
