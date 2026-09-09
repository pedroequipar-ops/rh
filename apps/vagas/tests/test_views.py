import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
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


# --- Fluxo da vaga (pré-triagem) ---


@pytest.mark.django_db
def test_setor_cria_vaga_com_gate_ligado_fica_solicitada(
    company_factory, setor_factory, user_factory
):
    company = company_factory(exige_aprovacao_vaga=True)
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
def test_setor_cria_vaga_com_gate_desligado_fica_aprovada(
    company_factory, setor_factory, user_factory
):
    company = company_factory(exige_aprovacao_vaga=False)
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    r = client.post("/v1/vagas/", {"titulo": "Vendedor", "quantidade_vagas": 1})

    assert r.status_code == 201
    assert r.data["status"] == "APROVADA"


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
def test_fluxo_completo_ate_em_triagem(company_factory, user_factory, vaga_factory):
    company = company_factory()
    vaga = vaga_factory(company=company, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    assert (
        client.post(f"/v1/vagas/{vaga.id}/aprovar/", {}, format="json").status_code == 200
    )
    for destino in ("PUBLICADA", "RECEBENDO", "ENCERRADA", "EM_TRIAGEM"):
        r = client.post(
            f"/v1/vagas/{vaga.id}/transicionar/", {"para": destino}, format="json"
        )
        assert r.status_code == 200, (destino, r.data)
        assert r.data["status"] == destino

    hist = client.get(f"/v1/vagas/{vaga.id}/historico/")
    assert hist.status_code == 200
    assert {h["para_status"] for h in hist.data} >= {
        "APROVADA",
        "PUBLICADA",
        "RECEBENDO",
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
    vaga = vaga_factory(company=company, status=Vaga.Status.RECEBENDO)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    r = client.patch(
        f"/v1/vagas/{vaga.id}/",
        {"data_alvo_preenchimento": "2026-12-01", "status": "CANCELADA"},
        format="json",
    )
    assert r.status_code == 200
    assert r.data["data_alvo_preenchimento"] == "2026-12-01"
    assert r.data["status"] == "RECEBENDO"


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
def test_config_get_e_patch_exige_aprovacao(company_factory, setor_factory, user_factory):
    company = company_factory(exige_aprovacao_vaga=True)
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    rh_client = _client_for(rh, company)
    assert rh_client.get("/v1/company/config/").data["exige_aprovacao_vaga"] is True

    patch = rh_client.patch(
        "/v1/company/config/", {"exige_aprovacao_vaga": False}, format="json"
    )
    assert patch.status_code == 200
    assert patch.data["exige_aprovacao_vaga"] is False

    negado = _client_for(setor_user, company).patch(
        "/v1/company/config/", {"exige_aprovacao_vaga": True}, format="json"
    )
    assert negado.status_code == 403
