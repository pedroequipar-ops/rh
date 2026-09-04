import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_historico_rest_ordenado_e_escopado(
    company_factory, setor_factory, user_factory, candidato_factory, chat_mensagem_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    autor = user_factory(company=company, role=User.Role.RH)
    msg1 = chat_mensagem_factory(company=company, candidato=candidato, autor=autor, texto="oi")
    msg2 = chat_mensagem_factory(
        company=company, candidato=candidato, autor=autor, texto="tudo bem?"
    )

    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)
    response = client.get(f"/v1/candidatos/{candidato.id}/mensagens/")

    assert response.status_code == 200
    textos = [item["texto"] for item in response.data["results"]]
    assert textos == [msg1.texto, msg2.texto]


@pytest.mark.django_db
def test_historico_rest_404_para_setor_alheio(
    company_factory, setor_factory, user_factory, candidato_factory
):
    company = company_factory()
    setor_dono = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor_dono
    candidato.vaga.save()

    outro_setor_user = user_factory(company=company, role=User.Role.SETOR, setor=outro_setor)
    client = _client_for(outro_setor_user, company)
    response = client.get(f"/v1/candidatos/{candidato.id}/mensagens/")

    assert response.status_code == 404
