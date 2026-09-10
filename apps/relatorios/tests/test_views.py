import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.vagas.models import Vaga


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_relatorio_vaga_csv_export(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga_factory(company=company, setor=setor, titulo="Analista de Dados")

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/",
        {"entidade": "vaga", "campos": ["titulo", "status"]},
        format="json",
    )

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    conteudo = b"".join(response.streaming_content).decode("utf-8-sig")
    assert "Analista de Dados" in conteudo
    assert "Título;Status" in conteudo


@pytest.mark.django_db
def test_relatorio_preview_limita_a_20_linhas_json(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    for i in range(25):
        vaga_factory(company=company, setor=setor, titulo=f"Vaga {i}")

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/?preview=1",
        {"entidade": "vaga", "campos": ["titulo"]},
        format="json",
    )

    assert response.status_code == 200
    assert len(response.data) == 20
    assert "titulo" in response.data[0]


@pytest.mark.django_db
def test_relatorio_campo_invalido_retorna_400(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/",
        {"entidade": "vaga", "campos": ["titulo", "senha_do_banco"]},
        format="json",
    )

    assert response.status_code == 400
    assert "campos" in response.data


@pytest.mark.django_db
def test_relatorio_modo_agrupado_conta_por_status(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA)
    vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA)
    vaga_factory(company=company, setor=setor, status=Vaga.Status.PREENCHIDA)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/?preview=1",
        {"entidade": "vaga", "modo": "agrupado", "agrupamento": "status", "formato": "json"},
        format="json",
    )

    assert response.status_code == 200
    contagem = {row["grupo"]: row["total"] for row in response.data}
    assert contagem["Publicada"] == 2
    assert contagem["Preenchida"] == 1


@pytest.mark.django_db
def test_relatorio_modo_agrupado_sem_agrupamento_retorna_400(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/", {"entidade": "vaga", "modo": "agrupado"}, format="json"
    )

    assert response.status_code == 400
    assert "agrupamento" in response.data


@pytest.mark.django_db
def test_relatorio_setor_so_ve_as_proprias_vagas(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_a = setor_factory(company=company)
    setor_b = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor_a)
    vaga_factory(company=company, setor=setor_a, titulo="Da minha area")
    vaga_factory(company=company, setor=setor_b, titulo="De outra area")

    client = _client_for(setor_user, company)
    response = client.post(
        "/v1/relatorios/?preview=1",
        {"entidade": "vaga", "campos": ["titulo"]},
        format="json",
    )

    titulos = [row["titulo"] for row in response.data]
    assert titulos == ["Da minha area"]


@pytest.mark.django_db
def test_relatorio_candidato_formato_json(
    company_factory, setor_factory, user_factory, vaga_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)
    candidato_factory(company=company, vaga=vaga, nome="Fulano de Tal")

    client = _client_for(rh, company)
    response = client.post(
        "/v1/relatorios/",
        {"entidade": "candidato", "campos": ["nome", "vaga"], "formato": "json"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data[0]["nome"] == "Fulano de Tal"
    assert response.data[0]["vaga"] == vaga.titulo
