import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.vagas.models import Vaga, VagaNotificacao


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_feed_da_vaga_junta_historico_atividade_e_comentario(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.APROVADA)
    client = _client_for(rh, company)

    # transição (gera VagaHistoricoStatus + Atividade "mudou_status")
    resp_transicao = client.post(f"/v1/vagas/{vaga.id}/transicionar/", {"para": "PUBLICADA"})
    assert resp_transicao.status_code == 200

    # comentário
    resp_comentario = client.post(
        "/v1/atividade/comentarios/",
        {"alvo_tipo": "vaga", "alvo_id": str(vaga.id), "texto": "primeiro comentário"},
        format="json",
    )
    assert resp_comentario.status_code == 201

    resp_feed = client.get("/v1/atividade/", {"alvo_tipo": "vaga", "alvo_id": str(vaga.id)})
    assert resp_feed.status_code == 200
    tipos = {item["tipo"] for item in resp_feed.data}
    assert tipos == {"historico", "atividade", "comentario"}
    descricoes = [item["descricao"] for item in resp_feed.data]
    assert "primeiro comentário" in descricoes


@pytest.mark.django_db
def test_comentario_com_mencao_notifica_usuario_mencionado(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    autor = user_factory(company=company, role=User.Role.RH, username="ana")
    mencionado = user_factory(company=company, role=User.Role.RH, username="joao")
    vaga = vaga_factory(company=company, setor=setor)

    client = _client_for(autor, company)
    response = client.post(
        "/v1/atividade/comentarios/",
        {"alvo_tipo": "vaga", "alvo_id": str(vaga.id), "texto": "oi @joao, pode olhar isso?"},
        format="json",
    )

    assert response.status_code == 201
    assert VagaNotificacao.objects.filter(destinatario=mencionado, vaga=vaga).exists()
    assert not VagaNotificacao.objects.filter(destinatario=autor).exists()


@pytest.mark.django_db
def test_feed_isola_por_empresa(company_factory, setor_factory, user_factory, vaga_factory):
    outra_empresa = company_factory()
    outro_setor = setor_factory(company=outra_empresa)
    outra_vaga = vaga_factory(company=outra_empresa, setor=outro_setor)

    minha_empresa = company_factory()
    setor = setor_factory(company=minha_empresa)
    rh = user_factory(company=minha_empresa, role=User.Role.RH)
    client = _client_for(rh, minha_empresa)

    response = client.get(
        "/v1/atividade/", {"alvo_tipo": "vaga", "alvo_id": str(outra_vaga.id)}
    )
    assert response.status_code == 400
    assert response.data["alvo_id"] == "Não encontrado."


@pytest.mark.django_db
def test_setor_nao_acessa_atividade_de_vaga_de_outro_setor(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_a = setor_factory(company=company)
    setor_b = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor_b)
    vaga_do_setor_a = vaga_factory(company=company, setor=setor_a)

    client = _client_for(setor_user, company)
    response = client.get(
        "/v1/atividade/", {"alvo_tipo": "vaga", "alvo_id": str(vaga_do_setor_a.id)}
    )
    assert response.status_code == 403
