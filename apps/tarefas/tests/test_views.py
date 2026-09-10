from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tarefas.models import Tarefa


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
def test_criar_tarefa_assume_criador_como_responsavel_padrao(
    company_factory, user_factory
):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post("/v1/tarefas/", {"titulo": "Ligar pro candidato"}, format="json")

    assert response.status_code == 201
    assert response.data["responsavel"]["id"] == str(rh.id)
    assert response.data["concluida"] is False


@pytest.mark.django_db
def test_concluir_e_reabrir_tarefa(company_factory, user_factory, tarefa_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    tarefa = tarefa_factory(company=company, criado_por=rh, responsavel=rh)

    client = _client_for(rh, company)

    response = client.post(f"/v1/tarefas/{tarefa.id}/concluir/")
    assert response.status_code == 200
    assert response.data["concluida"] is True

    response = client.post(f"/v1/tarefas/{tarefa.id}/reabrir/")
    assert response.status_code == 200
    assert response.data["concluida"] is False


@pytest.mark.django_db
def test_setor_so_ve_tarefas_proprias(company_factory, setor_factory, user_factory, tarefa_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    tarefa_factory(company=company, criado_por=rh, responsavel=rh, titulo="Da RH")
    tarefa_factory(company=company, criado_por=setor_user, responsavel=setor_user, titulo="Do setor")

    client = _client_for(setor_user, company)
    response = client.get("/v1/tarefas/")

    assert response.status_code == 200
    titulos = [t["titulo"] for t in response.data["results"]]
    assert titulos == ["Do setor"]


@pytest.mark.django_db
def test_filtro_pendentes_e_responsavel(company_factory, user_factory, tarefa_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    outro = user_factory(company=company, role=User.Role.RH)
    tarefa_factory(company=company, criado_por=rh, responsavel=rh, done_at=timezone.now())
    pendente = tarefa_factory(company=company, criado_por=rh, responsavel=outro)

    client = _client_for(rh, company)
    response = client.get("/v1/tarefas/", {"pendentes": "1", "responsavel": str(outro.id)})

    assert response.status_code == 200
    ids = [t["id"] for t in response.data["results"]]
    assert ids == [str(pendente.id)]


@pytest.mark.django_db
def test_rodar_lembretes_notifica_responsavel_via_sino_da_vaga(
    company_factory, setor_factory, user_factory, vaga_factory
):
    from apps.tarefas import services

    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)
    Tarefa.objects.create(
        company=company,
        titulo="Follow-up",
        criado_por=rh,
        responsavel=rh,
        alvo_tipo="VAGA",
        alvo_id=vaga.id,
        due_at=timezone.now() - timedelta(days=1),
    )

    total = services.rodar_lembretes()

    assert total == 1
    assert vaga.notificacoes.filter(destinatario=rh).exists()
    # Segunda chamada não duplica: lembrete_enviado_em já carimbado.
    assert services.rodar_lembretes() == 0


@pytest.mark.django_db
def test_mudar_responsavel_da_vaga_registra_atividade(
    company_factory, setor_factory, user_factory, vaga_factory
):
    from apps.atividade.models import Atividade

    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    novo_responsavel = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)

    client = _client_for(rh, company)
    response = client.patch(
        f"/v1/vagas/{vaga.id}/", {"responsavel_id": str(novo_responsavel.id)}, format="json"
    )

    assert response.status_code == 200
    assert response.data["responsavel"]["id"] == str(novo_responsavel.id)
    assert Atividade.objects.filter(company=company, verbo="mudou_responsavel").count() == 1
    assert not Atividade.objects.filter(company=company, verbo="editou").exists()
