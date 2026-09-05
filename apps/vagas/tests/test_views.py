import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.vagas.models import EtapaKanban


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_rh_cria_vaga(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/vagas/",
        {
            "titulo": "Analista Financeiro",
            "descricao": "desc",
            "requisitos": "req",
            "quantidade_vagas": 2,
            "setor_id": str(setor.id),
        },
    )

    assert response.status_code == 201
    assert response.data["titulo"] == "Analista Financeiro"
    assert response.data["setor"]["id"] == str(setor.id)


@pytest.mark.django_db
def test_setor_cria_vaga_auto_vinculada(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.post(
        "/v1/vagas/",
        {"titulo": "Vendedor", "descricao": "desc", "requisitos": "req", "quantidade_vagas": 1},
    )

    assert response.status_code == 201
    assert response.data["setor"]["id"] == str(setor.id)


@pytest.mark.django_db
def test_setor_cria_vaga_notifica_rh(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(setor_user, company)
    response = client.post(
        "/v1/vagas/",
        {"titulo": "Vendedor", "descricao": "desc", "requisitos": "req", "quantidade_vagas": 1},
    )
    assert response.status_code == 201

    rh_client = _client_for(rh, company)
    listagem = rh_client.get("/v1/vagas-notificacoes/")
    assert listagem.status_code == 200
    assert len(listagem.data) == 1
    assert listagem.data[0]["vaga_id"] == response.data["id"]
    assert setor.nome in listagem.data[0]["mensagem"]

    marcar = rh_client.post("/v1/vagas-notificacoes/marcar-lidas/")
    assert marcar.status_code == 204

    listagem_apos = rh_client.get("/v1/vagas-notificacoes/")
    assert len(listagem_apos.data) == 0


@pytest.mark.django_db
def test_rh_cria_vaga_nao_gera_notificacao(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/vagas/",
        {
            "titulo": "Analista",
            "descricao": "desc",
            "requisitos": "req",
            "quantidade_vagas": 1,
            "setor_id": str(setor.id),
        },
    )
    assert response.status_code == 201

    listagem = client.get("/v1/vagas-notificacoes/")
    assert len(listagem.data) == 0


@pytest.mark.django_db
def test_setor_edita_a_propria_vaga(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.patch(f"/v1/vagas/{vaga.id}/", {"titulo": "Novo título"})

    assert response.status_code == 200
    vaga.refresh_from_db()
    assert vaga.titulo == "Novo título"


@pytest.mark.django_db
def test_setor_nao_pode_editar_setor_id_da_vaga(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.patch(f"/v1/vagas/{vaga.id}/", {"setor_id": str(outro_setor.id)})

    assert response.status_code == 200
    vaga.refresh_from_db()
    assert vaga.setor_id == setor.id


@pytest.mark.django_db
def test_setor_nao_pode_editar_vaga_de_outro_setor(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_dono = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor_dono)
    outro_setor_user = user_factory(company=company, role=User.Role.SETOR, setor=outro_setor)

    client = _client_for(outro_setor_user, company)
    response = client.patch(f"/v1/vagas/{vaga.id}/", {"titulo": "Hack"})

    assert response.status_code == 404


@pytest.mark.django_db
def test_setor_so_lista_vagas_proprias(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor_a = setor_factory(company=company)
    setor_b = setor_factory(company=company)
    vaga_factory(company=company, setor=setor_a)
    vaga_factory(company=company, setor=setor_b)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor_a)

    client = _client_for(setor_user, company)
    response = client.get("/v1/vagas/")

    assert response.status_code == 200
    assert response.data["count"] == 1


@pytest.mark.django_db
def test_vaga_de_outra_company_nunca_aparece(company_factory, user_factory, vaga_factory):
    outra_company = company_factory()
    vaga_factory(company=outra_company)

    minha_company = company_factory()
    rh = user_factory(company=minha_company, role=User.Role.RH)

    client = _client_for(rh, minha_company)
    response = client.get("/v1/vagas/")

    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.django_db
def test_setor_exclui_a_propria_vaga(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.delete(f"/v1/vagas/{vaga.id}/")

    assert response.status_code == 204
    vaga.refresh_from_db()
    assert vaga.active is False


@pytest.mark.django_db
def test_setor_nao_pode_excluir_vaga_de_outro_setor(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_dono = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor_dono)
    outro_setor_user = user_factory(company=company, role=User.Role.SETOR, setor=outro_setor)

    client = _client_for(outro_setor_user, company)
    response = client.delete(f"/v1/vagas/{vaga.id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_soft_delete_etapa_nao_aparece_em_objects_mas_existe_em_allobjects(
    company_factory, user_factory, etapa_factory
):
    company = company_factory()
    etapa = etapa_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.delete(f"/v1/etapas-kanban/{etapa.id}/")

    assert response.status_code == 204
    assert not EtapaKanban.objects.filter(id=etapa.id).exists()
    assert EtapaKanban.allobjects.filter(id=etapa.id).exists()
