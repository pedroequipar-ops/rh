from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
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
def test_mover_para_reprovado_marca_reprovado_em(
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

    assert response.status_code == 200
    candidato.refresh_from_db()
    assert candidato.reprovado_em is not None


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
