import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.atividade.models import Atividade
from apps.tags.models import Tag
from apps.tags.services import normalizar_nome


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


def test_normalizar_nome():
    assert normalizar_nome("#Possível Pessoa!") == "possvel-pessoa"
    assert normalizar_nome("  Urgente  ") == "urgente"
    assert normalizar_nome("#") == ""


@pytest.mark.django_db
def test_criar_vaga_com_tags_cria_e_associa(company_factory, setor_factory, user_factory):
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
            "quantidade_vagas": 1,
            "setor_id": str(setor.id),
            "tags": ["#Urgente-Setor", "possivel-pessoa"],
        },
        format="json",
    )

    assert response.status_code == 201
    nomes = sorted(t["nome"] for t in response.data["tags"])
    assert nomes == ["possivel-pessoa", "urgente-setor"]
    assert Tag.objects.filter(company=company).count() == 2
    assert Atividade.objects.filter(company=company, verbo="adicionou_tag").count() == 1


@pytest.mark.django_db
def test_atualizar_tags_registra_adicao_e_remocao(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)
    tag_antiga = Tag.objects.create(company=company, nome="antiga")
    vaga.tags.set([tag_antiga])

    client = _client_for(rh, company)
    response = client.patch(
        f"/v1/vagas/{vaga.id}/", {"tags": ["nova"]}, format="json"
    )

    assert response.status_code == 200
    assert [t["nome"] for t in response.data["tags"]] == ["nova"]
    assert Atividade.objects.filter(company=company, verbo="adicionou_tag").exists()
    assert Atividade.objects.filter(company=company, verbo="removeu_tag").exists()
    # PATCH só com tags não deve gerar o "editou" genérico (evita duplicar entrada).
    assert not Atividade.objects.filter(company=company, verbo="editou").exists()


@pytest.mark.django_db
def test_tags_autocomplete_conta_uso_por_empresa(
    company_factory, setor_factory, user_factory, vaga_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga1 = vaga_factory(company=company, setor=setor)
    vaga2 = vaga_factory(company=company, setor=setor)
    tag = Tag.objects.create(company=company, nome="remoto")
    vaga1.tags.add(tag)
    vaga2.tags.add(tag)
    candidato = candidato_factory(vaga=vaga1)
    candidato.tags.add(tag)

    outra_empresa = company_factory()
    Tag.objects.create(company=outra_empresa, nome="remoto")

    client = _client_for(rh, company)
    response = client.get("/v1/tags/", {"q": "rem"})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["nome"] == "remoto"
    assert response.data[0]["uso"] == 3
