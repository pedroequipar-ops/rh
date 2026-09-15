from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidatos.interfaces.i_alerta_risco_extractor import AlertaRiscoDTO, IAlertaRiscoExtractor
from apps.candidatos.interfaces.i_tag_extractor import ITagExtractor, TagsSugeridasDTO
from apps.vagas.models import EtapaKanban, Vaga, VagaHistoricoStatus, VagaNotificacao


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
def test_marcar_uma_notificacao_de_vaga_e_historico(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    setor_client = _client_for(setor_user, company)
    rh_client = _client_for(rh, company)

    for titulo in ("Vendedor", "Analista"):
        r = setor_client.post(
            "/v1/vagas/",
            {"titulo": titulo, "descricao": "desc", "requisitos": "req", "quantidade_vagas": 1},
        )
        assert r.status_code == 201

    notificacoes = list(VagaNotificacao.objects.filter(destinatario=rh).order_by("created_at"))
    assert len(notificacoes) == 2

    marcar_uma = rh_client.post(f"/v1/vagas-notificacoes/{notificacoes[0].id}/marcar/")
    assert marcar_uma.status_code == 204

    nao_lidas = rh_client.get("/v1/vagas-notificacoes/")
    assert len(nao_lidas.data) == 1

    historico = rh_client.get("/v1/vagas-notificacoes/?lida=true")
    assert historico.data["count"] == 1
    assert historico.data["results"][0]["lida"] is True

    outro_rh = user_factory(company=company, role=User.Role.RH)
    outro_client = _client_for(outro_rh, company)
    resposta_de_outro = outro_client.post(f"/v1/vagas-notificacoes/{notificacoes[1].id}/marcar/")
    assert resposta_de_outro.status_code == 404


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
    vaga = vaga_factory(company=company, setor=setor, urgente=False)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.patch(f"/v1/vagas/{vaga.id}/", {"urgente": True})

    assert response.status_code == 200
    vaga.refresh_from_db()
    assert vaga.urgente is True


@pytest.mark.django_db
def test_setor_nao_pode_editar_dados_da_solicitacao(
    company_factory, setor_factory, user_factory, vaga_factory
):
    """Título, descrição, requisitos, quantidade, salário, datas e motivo são
    os dados da solicitação original: depois de criada, só RH edita — o
    setor segue podendo mexer em urgente/prioridade/tags/responsável."""
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(
        company=company,
        setor=setor,
        titulo="Título original",
        descricao="desc original",
        requisitos="req original",
        quantidade_vagas=1,
        salario="1000.00",
        motivo_solicitacao=Vaga.MotivoSolicitacao.AUMENTO_QUADRO,
    )
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.patch(
        f"/v1/vagas/{vaga.id}/",
        {
            "titulo": "Hack",
            "descricao": "Hack",
            "requisitos": "Hack",
            "quantidade_vagas": 99,
            "salario": "9999.00",
            "motivo_solicitacao": Vaga.MotivoSolicitacao.SUBSTITUICAO,
        },
    )

    assert response.status_code == 200
    vaga.refresh_from_db()
    assert vaga.titulo == "Título original"
    assert vaga.descricao == "desc original"
    assert vaga.requisitos == "req original"
    assert vaga.quantidade_vagas == 1
    assert str(vaga.salario) == "1000.00"
    assert vaga.motivo_solicitacao == Vaga.MotivoSolicitacao.AUMENTO_QUADRO


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
def test_restaurar_vaga_excluida(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(company=company, setor=setor)

    client = _client_for(rh, company)
    client.delete(f"/v1/vagas/{vaga.id}/")
    vaga.refresh_from_db()
    assert vaga.active is False

    response = client.post(f"/v1/vagas/{vaga.id}/restaurar/")

    assert response.status_code == 200
    vaga.refresh_from_db()
    assert vaga.active is True


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


# --- Fluxo da vaga (pré-triagem) ---


@pytest.mark.django_db
def test_setor_cria_vaga_fica_solicitada(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(setor_user, company)
    r = client.post("/v1/vagas/", {"titulo": "Vendedor", "quantidade_vagas": 1})

    assert r.status_code == 201
    assert r.data["status"] == "SOLICITADA"
    assert r.data["solicitada_em"] is not None
    assert VagaNotificacao.objects.filter(destinatario=rh).count() == 1


@pytest.mark.django_db
def test_rh_cria_vaga_fica_aprovada(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    r = client.post(
        "/v1/vagas/",
        {"titulo": "Analista", "quantidade_vagas": 1, "setor_id": str(setor.id)},
    )

    assert r.status_code == 201
    assert r.data["status"] == "APROVADA"
    assert r.data["aprovada_por"] == rh.username


@pytest.mark.django_db
def test_rh_aprova_solicitada(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    r = client.post(
        f"/v1/vagas/{vaga.id}/aprovar/",
        {"prioridade": 3, "urgente": True, "data_alvo_preenchimento": "2026-10-01"},
        format="json",
    )

    assert r.status_code == 200
    assert r.data["status"] == "APROVADA"
    assert r.data["prioridade"] == 3
    assert r.data["urgente"] is True
    vaga.refresh_from_db()
    assert vaga.aprovada_por_id == rh.id
    assert vaga.aprovada_em is not None
    assert VagaHistoricoStatus.objects.filter(vaga=vaga, para_status="APROVADA").exists()


@pytest.mark.django_db
def test_rh_recusa_com_motivo(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    sem_motivo = client.post(f"/v1/vagas/{vaga.id}/recusar/", {}, format="json")
    assert sem_motivo.status_code == 400

    r = client.post(
        f"/v1/vagas/{vaga.id}/recusar/", {"motivo": "Sem budget"}, format="json"
    )
    assert r.status_code == 200
    assert r.data["status"] == "RECUSADA"
    assert r.data["motivo_recusa"] == "Sem budget"


@pytest.mark.django_db
def test_setor_nao_pode_aprovar(company_factory, setor_factory, user_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.SOLICITADA)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    r = client.post(f"/v1/vagas/{vaga.id}/aprovar/", {}, format="json")
    assert r.status_code == 403


@pytest.mark.django_db
def test_transicao_invalida_retorna_400(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/transicionar/", {"para": "PUBLICADA"}, format="json"
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_transicao_para_lixeira_sem_observacao_falha(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.PUBLICADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/transicionar/", {"para": "CANCELADA"}, format="json"
    )
    assert r.status_code == 400
    vaga.refresh_from_db()
    assert vaga.status == Vaga.Status.PUBLICADA


@pytest.mark.django_db
def test_fluxo_completo_ate_em_triagem(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    assert (
        client.post(f"/v1/vagas/{vaga.id}/aprovar/", {}, format="json").status_code == 200
    )
    for destino in ("PUBLICADA", "ENCERRADA", "EM_TRIAGEM"):
        payload = {"para": destino}
        if destino == "ENCERRADA":
            payload["observacao"] = "Prazo estourado sem candidatos"
        r = client.post(f"/v1/vagas/{vaga.id}/transicionar/", payload, format="json")
        assert r.status_code == 200, (destino, r.data)
        assert r.data["status"] == destino

    hist = client.get(f"/v1/vagas/{vaga.id}/historico/")
    assert hist.status_code == 200
    assert {h["para_status"] for h in hist.data} >= {
        "APROVADA",
        "PUBLICADA",
        "ENCERRADA",
        "EM_TRIAGEM",
    }


@pytest.mark.django_db
def test_congelar_e_descongelar_volta_status_anterior(
    company_factory, user_factory, vaga_factory
):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.PUBLICADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/transicionar/", {"para": "CONGELADA"}, format="json"
    )
    assert r.status_code == 200
    assert r.data["status_pre_congelamento"] == "PUBLICADA"

    volta = client.post(
        f"/v1/vagas/{vaga.id}/transicionar/", {"para": "PUBLICADA"}, format="json"
    )
    assert volta.status_code == 200
    assert volta.data["status"] == "PUBLICADA"
    assert volta.data["status_pre_congelamento"] == ""


@pytest.mark.django_db
def test_cobrar_solicitada_notifica_rh_e_incrementa_contador(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.SOLICITADA)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(setor_user, company)
    r = client.post(f"/v1/vagas/{vaga.id}/cobrar/", {"mensagem": "urgente"}, format="json")

    assert r.status_code == 200
    assert r.data["cobrancas_enviadas"] == 1
    vaga.refresh_from_db()
    assert vaga.total_cobrancas == 1
    assert vaga.cobrada_em is not None
    assert VagaNotificacao.objects.filter(destinatario=rh, vaga=vaga).exists()


@pytest.mark.django_db
def test_cobrar_por_responsavel_atual_falha(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(f"/v1/vagas/{vaga.id}/cobrar/", {}, format="json")
    assert r.status_code == 400


@pytest.mark.django_db
def test_setor_so_cobra_vaga_do_proprio_setor(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor_dono = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor_dono, status=Vaga.Status.SOLICITADA)
    outro_user = user_factory(company=company, role=User.Role.SETOR, setor=outro_setor)

    client = _client_for(outro_user, company)
    r = client.post(f"/v1/vagas/{vaga.id}/cobrar/", {}, format="json")
    assert r.status_code == 404


@pytest.mark.django_db
def test_listagem_ordena_urgente_e_prioridade_primeiro(
    company_factory, user_factory, vaga_factory
):
    company = company_factory()
    vaga_factory(
        company=company, titulo="Normal", urgente=False, prioridade=Vaga.Prioridade.BAIXA
    )
    vaga_factory(
        company=company, titulo="Urgente", urgente=True, prioridade=Vaga.Prioridade.BAIXA
    )
    vaga_factory(
        company=company, titulo="Alta", urgente=False, prioridade=Vaga.Prioridade.ALTA
    )
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    r = client.get("/v1/vagas/")
    titulos = [v["titulo"] for v in r.data["results"]]

    assert titulos[0] == "Urgente"
    assert titulos.index("Alta") < titulos.index("Normal")


@pytest.mark.django_db
def test_patch_edita_datas_sem_mudar_status(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.PUBLICADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.patch(
        f"/v1/vagas/{vaga.id}/",
        {"data_alvo_preenchimento": "2026-12-01", "status": "CANCELADA"},
        format="json",
    )
    assert r.status_code == 200
    assert r.data["data_alvo_preenchimento"] == "2026-12-01"
    assert r.data["status"] == "PUBLICADA"


@pytest.mark.django_db
def test_vaga_em_triagem_ganha_etapa_inicial(
    company_factory, user_factory, vaga_factory, etapa_factory
):
    company = company_factory()
    etapa_factory(company=company, nome="Triagem", ordem=0, exige_cadastro_completo=False)
    etapa_factory(
        company=company, nome="Perfil Comportamental", ordem=2, exige_cadastro_completo=True
    )
    vaga = vaga_factory(company=company, status=Vaga.Status.ENCERRADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/transicionar/", {"para": "EM_TRIAGEM"}, format="json"
    )
    assert r.status_code == 200
    assert r.data["etapa_atual"]["nome"] == "Triagem"


@pytest.mark.django_db
def test_mover_card_da_vaga_entre_etapas_de_triagem(
    company_factory, user_factory, vaga_factory, etapa_factory
):
    company = company_factory()
    etapa_factory(company=company, nome="Triagem", ordem=0, exige_cadastro_completo=False)
    e1 = etapa_factory(
        company=company, nome="Primeira Entrevista", ordem=1, exige_cadastro_completo=False
    )
    vaga = vaga_factory(company=company, status=Vaga.Status.EM_TRIAGEM)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/mover-etapa/", {"etapa_id": str(e1.id)}, format="json"
    )
    assert r.status_code == 200
    assert r.data["etapa_atual"]["id"] == str(e1.id)


@pytest.mark.django_db
def test_mover_card_da_vaga_para_etapa_que_exige_cadastro_falha(
    company_factory, user_factory, vaga_factory, etapa_factory
):
    company = company_factory()
    perfil = etapa_factory(
        company=company, nome="Perfil Comportamental", ordem=2, exige_cadastro_completo=True
    )
    vaga = vaga_factory(company=company, status=Vaga.Status.EM_TRIAGEM)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/mover-etapa/", {"etapa_id": str(perfil.id)}, format="json"
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_mover_card_da_vaga_fora_de_triagem_falha(
    company_factory, user_factory, vaga_factory, etapa_factory
):
    company = company_factory()
    etapa = etapa_factory(company=company, nome="Triagem", ordem=0)
    vaga = vaga_factory(company=company, status=Vaga.Status.APROVADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(
        f"/v1/vagas/{vaga.id}/mover-etapa/", {"etapa_id": str(etapa.id)}, format="json"
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_patch_qtd_pessoas_fase(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.EM_TRIAGEM)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.patch(f"/v1/vagas/{vaga.id}/", {"qtd_pessoas_fase": 20}, format="json")
    assert r.status_code == 200
    assert r.data["qtd_pessoas_fase"] == 20


@pytest.mark.django_db
def test_registrar_candidaturas_recebidas_vai_pro_historico(
    company_factory, user_factory, vaga_factory
):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.PUBLICADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.post(f"/v1/vagas/{vaga.id}/candidaturas/", {"quantidade": 12}, format="json")
    assert r.status_code == 200
    assert r.data["qtd_pessoas_fase"] == 12

    hist = client.get(f"/v1/vagas/{vaga.id}/historico/")
    assert any(h["observacao"].startswith("Candidaturas recebidas: 12") for h in hist.data)

    # fora de PUBLICADA não deixa
    client.post(
        f"/v1/vagas/{vaga.id}/transicionar/",
        {"para": "CANCELADA", "observacao": "Vaga cancelada pelo solicitante"},
        format="json",
    )
    bloqueado = client.post(
        f"/v1/vagas/{vaga.id}/candidaturas/", {"quantidade": 3}, format="json"
    )
    assert bloqueado.status_code == 400


@pytest.mark.django_db
def test_alertar_prazo_estourado_notifica_rh_uma_vez(
    company_factory, user_factory, vaga_factory
):
    from datetime import date

    from apps.vagas import services
    from apps.vagas.models import VagaNotificacao

    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(
        company=company,
        status=Vaga.Status.PUBLICADA,
        data_alvo_preenchimento=date(2020, 1, 1),
    )
    no_prazo = vaga_factory(
        company=company,
        status=Vaga.Status.PUBLICADA,
        data_alvo_preenchimento=date(2999, 1, 1),
    )

    assert services.alertar_vagas_com_prazo_estourado() == 1
    assert services.alertar_vagas_com_prazo_estourado() == 0  # não repete

    vaga.refresh_from_db()
    assert vaga.prazo_alertado_em is not None
    no_prazo.refresh_from_db()
    assert no_prazo.prazo_alertado_em is None
    assert VagaNotificacao.objects.filter(destinatario=rh, vaga=vaga).count() == 1

    # empurrar a data pro futuro zera o alerta
    client = _client_for(rh, company)
    client.patch(
        f"/v1/vagas/{vaga.id}/",
        {"data_alvo_preenchimento": "2999-01-01"},
        format="json",
    )
    vaga.refresh_from_db()
    assert vaga.prazo_alertado_em is None


class FakeAlertaRiscoExtractor(IAlertaRiscoExtractor):
    def redigir(self, contexto):
        return AlertaRiscoDTO(mensagem=f"Risco alto: {contexto['total_candidatos']} candidatos.")


class FakeAlertaRiscoExtractorFalha(IAlertaRiscoExtractor):
    def redigir(self, contexto):
        raise RuntimeError("IA indisponível")


@pytest.mark.django_db
@patch(
    "apps.vagas.services.settings.VAGAS_ALERTA_RISCO_EXTRACTOR_CLASS",
    "apps.vagas.tests.test_views.FakeAlertaRiscoExtractor",
)
def test_alertar_prazo_usa_mensagem_da_ia_quando_disponivel(
    company_factory, user_factory, vaga_factory
):
    from datetime import date

    from apps.vagas import services
    from apps.vagas.models import VagaNotificacao

    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(
        company=company, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=date(2020, 1, 1)
    )

    services.alertar_vagas_com_prazo_estourado()

    notificacao = VagaNotificacao.objects.get(destinatario=rh, vaga=vaga)
    assert notificacao.mensagem == "Risco alto: 0 candidatos."


@pytest.mark.django_db
@patch(
    "apps.vagas.services.settings.VAGAS_ALERTA_RISCO_EXTRACTOR_CLASS",
    "apps.vagas.tests.test_views.FakeAlertaRiscoExtractorFalha",
)
def test_alertar_prazo_cai_para_mensagem_fixa_se_ia_falhar(
    company_factory, user_factory, vaga_factory
):
    from datetime import date

    from apps.vagas import services
    from apps.vagas.models import VagaNotificacao

    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(
        company=company, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=date(2020, 1, 1)
    )

    total = services.alertar_vagas_com_prazo_estourado()

    assert total == 1
    notificacao = VagaNotificacao.objects.get(destinatario=rh, vaga=vaga)
    assert notificacao.mensagem == f'Vaga "{vaga.titulo}" passou do prazo de preenchimento/início.'


@pytest.mark.django_db
def test_alertar_prazo_extractor_recebe_sinais_completos(
    company_factory, user_factory, vaga_factory, candidato_factory, etapa_factory
):
    from datetime import date

    from apps.vagas import services

    company = company_factory()
    user_factory(company=company, role=User.Role.RH)
    vaga = vaga_factory(
        company=company, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=date(2020, 1, 1)
    )
    etapa = etapa_factory(company=company)
    candidato_factory(company=company, vaga=vaga, etapa_atual=etapa)

    with patch(
        "apps.candidatos.extractors.groq_alerta_risco_extractor.GroqAlertaRiscoExtractor.redigir"
    ) as mock_redigir:
        mock_redigir.return_value = AlertaRiscoDTO(mensagem="ok")
        services.alertar_vagas_com_prazo_estourado()

    (contexto,) = mock_redigir.call_args[0]
    assert contexto["vaga_titulo"] == vaga.titulo
    assert contexto["dias_de_atraso_no_prazo"] > 0
    assert contexto["total_candidatos"] == 1


class FakeVagaTagExtractor(ITagExtractor):
    def sugerir(self, perfil, tags_existentes):
        return TagsSugeridasDTO(tags=["urgente"], interpretacao="Vaga prioritária.")


class FakeVagaTagExtractorFalha(ITagExtractor):
    def sugerir(self, perfil, tags_existentes):
        raise RuntimeError("IA indisponível")


@pytest.mark.django_db
@patch(
    "apps.vagas.services.settings.VAGAS_TAG_EXTRACTOR_CLASS",
    "apps.vagas.tests.test_views.FakeVagaTagExtractor",
)
def test_sugerir_tags_vaga_retorna_sugestoes_sem_aplicar(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(f"/v1/vagas/{vaga.id}/sugerir-tags/")

    assert response.status_code == 200
    assert response.data["tags"] == ["urgente"]
    vaga.refresh_from_db()
    assert list(vaga.tags.all()) == []


@pytest.mark.django_db
@patch(
    "apps.vagas.services.settings.VAGAS_TAG_EXTRACTOR_CLASS",
    "apps.vagas.tests.test_views.FakeVagaTagExtractorFalha",
)
def test_sugerir_tags_vaga_com_falha_da_ia_retorna_erro_amigavel(
    company_factory, setor_factory, user_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(f"/v1/vagas/{vaga.id}/sugerir-tags/")

    assert response.status_code == 400
