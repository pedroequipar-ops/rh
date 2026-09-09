import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_busca_encontra_vaga_candidato_e_setor(
    company_factory, setor_factory, user_factory, vaga_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company, nome="Financeiro")
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor, titulo="Analista Financeiro")
    candidato = candidato_factory(vaga=vaga, nome="Ana Financeira")

    client = _client_for(rh, company)
    response = client.get("/v1/busca/", {"q": "financ"})

    assert response.status_code == 200
    assert response.data["vagas"] == [
        {"id": str(vaga.id), "titulo": vaga.titulo, "status": vaga.status}
    ]
    assert response.data["candidatos"] == [{"id": str(candidato.id), "nome": candidato.nome}]
    assert response.data["setores"] == [{"id": str(setor.id), "nome": setor.nome}]


@pytest.mark.django_db
def test_busca_sem_termo_retorna_vazio(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.get("/v1/busca/")

    assert response.status_code == 200
    assert response.data == {"vagas": [], "candidatos": [], "setores": []}


@pytest.mark.django_db
def test_busca_isola_por_empresa(
    company_factory, setor_factory, user_factory, vaga_factory
):
    outra_empresa = company_factory()
    setor_factory(company=outra_empresa)
    vaga_factory(company=outra_empresa, titulo="Vaga de outra empresa")

    minha_empresa = company_factory()
    rh = user_factory(company=minha_empresa, role=User.Role.RH)

    client = _client_for(rh, minha_empresa)
    response = client.get("/v1/busca/", {"q": "outra"})

    assert response.data["vagas"] == []


@pytest.mark.django_db
def test_busca_setor_so_ve_o_proprio_setor(
    company_factory, setor_factory, user_factory, vaga_factory, candidato_factory
):
    company = company_factory()
    setor_a = setor_factory(company=company, nome="Setor A")
    setor_b = setor_factory(company=company, nome="Setor B")
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor_a)
    vaga_a = vaga_factory(company=company, setor=setor_a, titulo="Vaga do setor A")
    vaga_factory(company=company, setor=setor_b, titulo="Vaga do setor B")

    client = _client_for(setor_user, company)

    response_vagas = client.get("/v1/busca/", {"q": "vaga"})
    assert [v["id"] for v in response_vagas.data["vagas"]] == [str(vaga_a.id)]

    response_setores = client.get("/v1/busca/", {"q": "setor"})
    assert [s["id"] for s in response_setores.data["setores"]] == [str(setor_a.id)]


@pytest.mark.django_db
def test_busca_com_hashtag_retorna_vazio(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.get("/v1/busca/", {"q": "#urgente"})

    assert response.data == {"vagas": [], "candidatos": [], "setores": []}
