from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidatos.interfaces.i_busca_ia_extractor import (
    FiltroBuscaIADTO,
    IBuscaCandidatosExtractor,
)
from apps.candidatos.interfaces.i_curriculo_extractor import (
    CandidatoExtraidoDTO,
    ICurriculoExtractor,
)
from apps.candidatos.models import Candidato, CandidatoNotificacao


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


class FakeExtractorSucesso(ICurriculoExtractor):
    def extrair(self, texto_curriculo, vagas_abertas):
        vaga_id = str(vagas_abertas[0]["id"]) if vagas_abertas else None
        return CandidatoExtraidoDTO(
            nome="João da Silva",
            email="joao@example.com",
            telefone="11988887777",
            cpf="12345678900",
            linkedin_url="https://linkedin.com/in/joao",
            vaga_sugerida_id=vaga_id,
            justificativa="Perfil compatível.",
        )


class FakeExtractorFalha(ICurriculoExtractor):
    def extrair(self, texto_curriculo, vagas_abertas):
        raise RuntimeError("IA indisponível")


@pytest.mark.django_db
@patch("apps.candidatos.views.MinioStorage")
@patch("apps.candidatos.views.QueueEngine")
def test_rh_cria_candidato_apos_upload_url(
    mock_queue,
    mock_storage,
    company_factory,
    setor_factory,
    user_factory,
    etapa_factory,
    vaga_factory,
):
    mock_storage.return_value.head_object.return_value = True
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/candidatos/",
        {
            "nome": "Maria Souza",
            "email": "maria@example.com",
            "telefone": "11999999999",
            "cpf": "11122233344",
            "vaga_id": str(vaga.id),
            "curriculo_key": "candidatos/abc.pdf",
        },
    )

    assert response.status_code == 201
    assert response.data["nome"] == "Maria Souza"
    assert response.data["etapa_atual"] is not None
    assert mock_queue.return_value.publish.called


@pytest.mark.django_db
@patch("apps.candidatos.views.MinioStorage")
@patch("apps.candidatos.views.QueueEngine")
def test_rh_cria_candidato_sem_curriculo(
    mock_queue,
    mock_storage,
    company_factory,
    setor_factory,
    user_factory,
    etapa_factory,
    vaga_factory,
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/candidatos/",
        {
            "nome": "Sem Curriculo",
            "email": "semcurriculo@example.com",
            "telefone": "11999999999",
            "vaga_id": str(vaga.id),
            "curriculo_key": "",
        },
    )

    assert response.status_code == 201
    assert response.data["curriculo_key"] == ""
    mock_storage.return_value.head_object.assert_not_called()

    candidato_id = response.data["id"]
    curriculo_url = client.get(f"/v1/candidatos/{candidato_id}/curriculo-url/")
    assert curriculo_url.status_code == 404


@pytest.mark.django_db
def test_setor_nao_pode_criar_candidato(
    company_factory, setor_factory, user_factory, etapa_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.post(
        "/v1/candidatos/",
        {
            "nome": "Maria Souza",
            "vaga_id": str(vaga.id),
            "curriculo_key": "candidatos/abc.pdf",
        },
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_candidato_expoe_dados_de_fluxo_da_vaga(
    company_factory, user_factory, candidato_factory
):
    from datetime import date

    company = company_factory()
    candidato = candidato_factory(company=company)
    candidato.vaga.prioridade = 3
    candidato.vaga.urgente = True
    candidato.vaga.data_alvo_preenchimento = date(2020, 1, 1)
    candidato.vaga.motivo_solicitacao = "SUBSTITUICAO"
    candidato.vaga.save()

    rh = user_factory(company=company, role=User.Role.RH)
    r = _client_for(rh, company).get(f"/v1/candidatos/{candidato.id}/")

    assert r.status_code == 200
    vaga = r.data["vaga"]
    assert vaga["prioridade_display"] == "Alta"
    assert vaga["urgente"] is True
    assert vaga["motivo_solicitacao_display"] == "Substituição"
    assert vaga["data_alvo_preenchimento"] == "2020-01-01"
    assert "solicitada_em" in vaga and "triagem_iniciada_em" in vaga
    # vaga_id continua disponível para escrita/leitura simples
    assert str(r.data["vaga_id"]) == str(candidato.vaga_id)


@pytest.mark.django_db
def test_rh_move_candidato_de_etapa(
    company_factory, setor_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_destino = etapa_factory(company=company, nome="Primeira Entrevista", ordem=1)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_destino.id)}
    )

    assert response.status_code == 200
    assert response.data["etapa_atual"]["id"] == str(etapa_destino.id)


@pytest.mark.django_db
def test_setor_nao_pode_mover_candidato_de_etapa(
    company_factory, setor_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_destino = etapa_factory(company=company, nome="Primeira Entrevista", ordem=1)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    client = _client_for(setor_user, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_destino.id)}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_mover_etapa_notifica_usuarios_do_setor(
    company_factory, setor_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    etapa_destino = etapa_factory(company=company, nome="Primeira Entrevista", ordem=1)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    rh = user_factory(company=company, role=User.Role.RH)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    outro_setor_user = user_factory(company=company, role=User.Role.SETOR, setor=outro_setor)
    client = _client_for(rh, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_destino.id)}
    )

    assert response.status_code == 200
    notificacoes = CandidatoNotificacao.objects.filter(candidato=candidato)
    destinatarios = {n.destinatario_id for n in notificacoes}
    assert destinatarios == {setor_user.id}
    assert outro_setor_user.id not in destinatarios
    assert etapa_destino.nome in notificacoes.first().mensagem

    setor_client = _client_for(setor_user, company)
    listagem = setor_client.get("/v1/candidatos-notificacoes/")
    assert listagem.status_code == 200
    assert len(listagem.data) == 1

    marcar = setor_client.post("/v1/candidatos-notificacoes/marcar-lidas/")
    assert marcar.status_code == 204

    listagem_apos = setor_client.get("/v1/candidatos-notificacoes/")
    assert len(listagem_apos.data) == 0


@pytest.mark.django_db
def test_marcar_uma_notificacao_e_historico(
    company_factory, setor_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_a = etapa_factory(company=company, nome="Primeira Entrevista", ordem=1)
    etapa_b = etapa_factory(company=company, nome="Perfil Comportamental", ordem=2)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    rh = user_factory(company=company, role=User.Role.RH)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    rh_client = _client_for(rh, company)
    setor_client = _client_for(setor_user, company)

    rh_client.patch(f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_a.id)})
    rh_client.patch(f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_b.id)})

    notificacoes = list(
        CandidatoNotificacao.objects.filter(destinatario=setor_user).order_by("created_at")
    )
    assert len(notificacoes) == 2

    marcar_uma = setor_client.post(f"/v1/candidatos-notificacoes/{notificacoes[0].id}/marcar/")
    assert marcar_uma.status_code == 204

    nao_lidas = setor_client.get("/v1/candidatos-notificacoes/")
    assert len(nao_lidas.data) == 1
    assert nao_lidas.data[0]["id"] == str(notificacoes[1].id)

    historico = setor_client.get("/v1/candidatos-notificacoes/?lida=true")
    assert historico.status_code == 200
    assert historico.data["count"] == 1
    assert historico.data["results"][0]["id"] == str(notificacoes[0].id)
    assert historico.data["results"][0]["lida"] is True
    assert historico.data["results"][0]["lida_em"] is not None

    desmarcar = setor_client.post(
        f"/v1/candidatos-notificacoes/{notificacoes[0].id}/marcar/", {"lida": False}
    )
    assert desmarcar.status_code == 204
    nao_lidas_apos = setor_client.get("/v1/candidatos-notificacoes/")
    assert len(nao_lidas_apos.data) == 2

    outro_usuario = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    outro_client = _client_for(outro_usuario, company)
    marcar_de_outro = outro_client.post(f"/v1/candidatos-notificacoes/{notificacoes[1].id}/marcar/")
    assert marcar_de_outro.status_code == 404


@pytest.mark.django_db
def test_mover_para_reprovado_marca_reprovado_em(
    company_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    etapa_reprovado = etapa_factory(company=company, nome="Reprovado", is_saida_negativa=True)
    candidato = candidato_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/mover-etapa/",
        {"etapa_id": str(etapa_reprovado.id), "motivo": "Perfil não compatível com a vaga"},
    )

    assert response.status_code == 200
    candidato.refresh_from_db()
    assert candidato.reprovado_em is not None


@pytest.mark.django_db
def test_mover_para_saida_negativa_sem_motivo_falha(
    company_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    etapa_reprovado = etapa_factory(company=company, nome="Reprovado", is_saida_negativa=True)
    candidato = candidato_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/mover-etapa/", {"etapa_id": str(etapa_reprovado.id)}
    )

    assert response.status_code == 400
    candidato.refresh_from_db()
    assert candidato.etapa_atual_id != etapa_reprovado.id


@pytest.mark.django_db
def test_reprovado_ha_mais_de_30_dias_e_excluido_ao_listar(
    company_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    etapa_reprovado = etapa_factory(company=company, nome="Reprovado", is_saida_negativa=True)
    candidato_vencido = candidato_factory(
        company=company,
        etapa_atual=etapa_reprovado,
        reprovado_em=timezone.now() - timedelta(days=31),
    )
    candidato_recente = candidato_factory(
        company=company,
        etapa_atual=etapa_reprovado,
        reprovado_em=timezone.now() - timedelta(days=5),
    )
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.get("/v1/candidatos/")

    assert response.status_code == 200
    ids = [item["id"] for item in response.data["results"]]
    assert str(candidato_vencido.id) not in ids
    assert str(candidato_recente.id) in ids

    candidato_vencido.refresh_from_db()
    assert candidato_vencido.active is False


@pytest.mark.django_db
@patch("apps.candidatos.views.MinioStorage")
def test_rh_e_setor_dono_veem_curriculo_url(
    mock_storage, company_factory, setor_factory, user_factory, candidato_factory
):
    mock_storage.return_value.presigned_url.return_value = "https://minio.local/presigned"
    company = company_factory()
    setor = setor_factory(company=company)
    candidato = candidato_factory(company=company)
    candidato.vaga.setor = setor
    candidato.vaga.save()

    rh = user_factory(company=company, role=User.Role.RH)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    for user in (rh, setor_user):
        client = _client_for(user, company)
        response = client.get(f"/v1/candidatos/{candidato.id}/curriculo-url/")
        assert response.status_code == 200
        assert response.data["curriculo_url"] == "https://minio.local/presigned"


@pytest.mark.django_db
def test_setor_de_outro_setor_recebe_404_em_candidato_alheio(
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
    response = client.get(f"/v1/candidatos/{candidato.id}/")

    assert response.status_code == 404


@pytest.mark.django_db
@patch(
    "apps.candidatos.services.settings.CURRICULO_EXTRACTOR_CLASS",
    "apps.candidatos.tests.test_views.FakeExtractorSucesso",
)
@patch("apps.candidatos.services.VagaRepository")
@patch("apps.candidatos.services._extrair_texto_pdf", return_value="texto do currículo")
@patch("apps.candidatos.services.MinioStorage")
def test_analisar_curriculo_com_fake_extractor_retorna_campos(
    mock_storage,
    mock_extrair_texto,
    mock_vaga_repo,
    company_factory,
    setor_factory,
    user_factory,
    etapa_factory,
    vaga_factory,
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    mock_vaga_repo.return_value.list_by_company.return_value = [vaga]
    mock_storage.return_value.get_object.return_value = b"%PDF-1.4 fake"

    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.post(
        "/v1/candidatos/analisar-curriculo/", {"curriculo_key": "candidatos/abc.pdf"}
    )

    assert response.status_code == 200
    assert response.data["nome"] == "João da Silva"
    assert response.data["vaga_sugerida_id"] == str(vaga.id)
    assert response.data["erro"] is False


@pytest.mark.django_db
@patch(
    "apps.candidatos.services.settings.CURRICULO_EXTRACTOR_CLASS",
    "apps.candidatos.tests.test_views.FakeExtractorFalha",
)
@patch("apps.candidatos.services.VagaRepository")
@patch("apps.candidatos.services._extrair_texto_pdf", return_value="texto do currículo")
@patch("apps.candidatos.services.MinioStorage")
def test_falha_da_ia_nao_impede_cadastro_manual(
    mock_storage,
    mock_extrair_texto,
    mock_vaga_repo,
    company_factory,
    setor_factory,
    user_factory,
    etapa_factory,
    vaga_factory,
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    mock_vaga_repo.return_value.list_by_company.return_value = [vaga]
    mock_storage.return_value.get_object.return_value = b"%PDF-1.4 fake"

    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    analise_response = client.post(
        "/v1/candidatos/analisar-curriculo/", {"curriculo_key": "candidatos/abc.pdf"}
    )
    assert analise_response.status_code == 200
    assert analise_response.data["nome"] == ""
    assert analise_response.data["vaga_sugerida_id"] is None
    assert analise_response.data["erro"] is True

    with patch("apps.candidatos.views.MinioStorage") as mock_view_storage, patch(
        "apps.candidatos.views.QueueEngine"
    ):
        mock_view_storage.return_value.head_object.return_value = True
        cadastro_response = client.post(
            "/v1/candidatos/",
            {
                "nome": "Preenchido manualmente",
                "vaga_id": str(vaga.id),
                "curriculo_key": "candidatos/abc.pdf",
            },
        )
    assert cadastro_response.status_code == 201
    assert Candidato.objects.filter(nome="Preenchido manualmente").exists()


@pytest.mark.django_db
def test_nao_cria_candidato_em_vaga_solicitada(
    company_factory, setor_factory, user_factory, etapa_factory, vaga_factory
):
    from apps.vagas.models import Vaga

    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company, nome="Triagem")
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.SOLICITADA)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    with patch("apps.candidatos.views.QueueEngine"):
        response = client.post(
            "/v1/candidatos/",
            {"nome": "X", "vaga_id": str(vaga.id), "curriculo_key": ""},
        )

    assert response.status_code == 400


@pytest.mark.django_db
@patch("apps.candidatos.views.QueueEngine")
def test_primeiro_candidato_move_vaga_para_em_triagem(
    mock_queue, company_factory, setor_factory, user_factory, etapa_factory, vaga_factory
):
    from apps.vagas.models import Vaga

    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company, nome="Triagem")
    vaga = vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA)
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post(
        "/v1/candidatos/",
        {"nome": "X", "vaga_id": str(vaga.id), "curriculo_key": ""},
    )

    assert response.status_code == 201
    vaga.refresh_from_db()
    assert vaga.status == Vaga.Status.EM_TRIAGEM


@pytest.mark.django_db
def test_rh_edita_candidato(company_factory, user_factory, candidato_factory):
    company = company_factory()
    candidato = candidato_factory(company=company, nome="Nome Antigo")
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    response = client.patch(
        f"/v1/candidatos/{candidato.id}/",
        {"nome": "Nome Novo", "telefone": "11900001111"},
    )

    assert response.status_code == 200
    assert response.data["nome"] == "Nome Novo"
    assert str(response.data["vaga_id"]) == str(candidato.vaga_id)
    candidato.refresh_from_db()
    assert candidato.telefone == "11900001111"


@pytest.mark.django_db
def test_restaurar_candidato_excluido(company_factory, user_factory, candidato_factory):
    company = company_factory()
    candidato = candidato_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    client = _client_for(rh, company)

    client.delete(f"/v1/candidatos/{candidato.id}/")
    candidato.refresh_from_db()
    assert candidato.active is False

    response = client.post(f"/v1/candidatos/{candidato.id}/restaurar/")

    assert response.status_code == 200
    candidato.refresh_from_db()
    assert candidato.active is True


class FakeBuscaExtractorPalavraChave(IBuscaCandidatosExtractor):
    def interpretar(self, frase, etapas, tags):
        return FiltroBuscaIADTO(palavras_chave=["excel avançado"], interpretacao="Habilidade contém 'excel avançado'.")


class FakeBuscaExtractorEtapaOrdemMin(IBuscaCandidatosExtractor):
    def interpretar(self, frase, etapas, tags):
        ordem_triagem = next(e["ordem"] for e in etapas if e["nome"] == "Triagem")
        return FiltroBuscaIADTO(
            etapa_ordem_min=ordem_triagem + 1, interpretacao="Já passou da etapa Triagem."
        )


class FakeBuscaExtractorFalha(IBuscaCandidatosExtractor):
    def interpretar(self, frase, etapas, tags):
        raise RuntimeError("IA indisponível")


@pytest.mark.django_db
@patch(
    "apps.candidatos.services.settings.CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS",
    "apps.candidatos.tests.test_views.FakeBuscaExtractorPalavraChave",
)
def test_rh_busca_candidatos_com_ia_por_palavra_chave(
    company_factory, setor_factory, user_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    com_match = candidato_factory(
        company=company,
        vaga__company=company,
        vaga__setor=setor,
        perfil_habilidades="Excel avançado, Power BI",
    )
    candidato_factory(
        company=company, vaga__company=company, vaga__setor=setor, perfil_habilidades="Word básico"
    )

    client = _client_for(rh, company)
    response = client.post("/v1/candidatos/busca-ia/", {"frase": "quem sabe excel avançado"})

    assert response.status_code == 200
    assert [item["id"] for item in response.data["resultados"]] == [str(com_match.id)]
    assert "excel avançado" in response.data["interpretacao"]


@pytest.mark.django_db
@patch(
    "apps.candidatos.services.settings.CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS",
    "apps.candidatos.tests.test_views.FakeBuscaExtractorEtapaOrdemMin",
)
def test_rh_busca_candidatos_com_ia_por_progresso_no_funil(
    company_factory, setor_factory, user_factory, etapa_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = etapa_factory(company=company, nome="Triagem", ordem=1)
    entrevista = etapa_factory(company=company, nome="Entrevista", ordem=2)
    avancado = candidato_factory(
        company=company, vaga__company=company, vaga__setor=setor, etapa_atual=entrevista
    )
    candidato_factory(
        company=company, vaga__company=company, vaga__setor=setor, etapa_atual=triagem
    )

    client = _client_for(rh, company)
    response = client.post("/v1/candidatos/busca-ia/", {"frase": "quem já passou da triagem"})

    assert response.status_code == 200
    assert [item["id"] for item in response.data["resultados"]] == [str(avancado.id)]


@pytest.mark.django_db
def test_setor_so_busca_dentro_do_proprio_setor(
    company_factory, setor_factory, user_factory, candidato_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    outro_setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    candidato_factory(company=company, vaga__company=company, vaga__setor=outro_setor)

    with patch(
        "apps.candidatos.services.settings.CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS",
        "apps.candidatos.tests.test_views.FakeBuscaExtractorPalavraChave",
    ):
        client = _client_for(setor_user, company)
        response = client.post("/v1/candidatos/busca-ia/", {"frase": "excel avançado"})

    assert response.status_code == 200
    assert response.data["resultados"] == []


@pytest.mark.django_db
@patch(
    "apps.candidatos.services.settings.CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS",
    "apps.candidatos.tests.test_views.FakeBuscaExtractorFalha",
)
def test_busca_ia_com_falha_da_ia_retorna_erro_amigavel(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.post("/v1/candidatos/busca-ia/", {"frase": "qualquer coisa"})

    assert response.status_code == 400
