from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.triagem_ia import services
from apps.triagem_ia.models import CandidatoTriagemIA, StatusTriagemIA
from apps.triagem_ia.serializers import MAX_ANEXO_WEBHOOK_BYTES

from .test_views import FakeTriagemExtractorSucesso

URL = "/v1/triagem-ia-webhook/curriculo/"


def _arquivo(nome="curriculo.pdf", content_type="application/pdf", conteudo=b"%PDF-1.4 conteudo"):
    return SimpleUploadedFile(nome, conteudo, content_type=content_type)


@pytest.mark.django_db
def test_webhook_sem_token_configurado_retorna_503(settings, company_factory):
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = ""
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company_factory().id)

    client = APIClient()
    response = client.post(
        URL,
        {"arquivo": _arquivo(), "email_remetente": "ana@example.com"},
        format="multipart",
    )

    assert response.status_code == 503


@pytest.mark.django_db
def test_webhook_token_errado_retorna_403(settings, company_factory):
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company_factory().id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-errado")
    response = client.post(
        URL,
        {"arquivo": _arquivo(), "email_remetente": "ana@example.com"},
        format="multipart",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_webhook_sem_token_no_header_retorna_403(settings, company_factory):
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company_factory().id)

    client = APIClient()
    response = client.post(
        URL,
        {"arquivo": _arquivo(), "email_remetente": "ana@example.com"},
        format="multipart",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_webhook_tipo_de_arquivo_nao_suportado_retorna_400(mock_storage, settings, company_factory):
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company_factory().id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-certo")
    response = client.post(
        URL,
        {
            "arquivo": _arquivo(nome="curriculo.txt", content_type="text/plain", conteudo=b"oi"),
            "email_remetente": "ana@example.com",
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_webhook_sem_tag_de_vaga_cai_como_nao_roteado(mock_storage, settings, company_factory):
    company = company_factory()
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company.id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-certo")
    response = client.post(
        URL,
        {
            "arquivo": _arquivo(),
            "email_remetente": "ana@example.com",
            "nome_remetente": "Ana",
            "assunto": "Currículo para vaga de dev",
        },
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["roteado"] is False
    triagem = CandidatoTriagemIA.objects.get(id=response.data["id"])
    assert triagem.vaga_id is None
    assert triagem.email_remetente == "ana@example.com"
    assert triagem.curriculo_key


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
@patch("apps.triagem_ia.services.candidatos_services.extrair_texto_anexo", return_value="texto")
@patch(
    "apps.triagem_ia.services.settings.TRIAGEM_IA_EXTRACTOR_CLASS",
    "apps.triagem_ia.tests.test_views.FakeTriagemExtractorSucesso",
)
def test_webhook_com_tag_de_vaga_roteia_e_pontua_na_hora(
    mock_extrair, mock_storage, settings, company_factory, setor_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, codigo_email="abc123")
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company.id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-certo")
    response = client.post(
        URL,
        {
            "arquivo": _arquivo(),
            "email_remetente": "ana@example.com",
            "assunto": "[VAGA:abc123] Currículo",
        },
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["roteado"] is True
    assert response.data["status"] == StatusTriagemIA.PRONTO
    triagem = CandidatoTriagemIA.objects.get(id=response.data["id"])
    assert triagem.vaga_id == vaga.id
    assert triagem.score == 95


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_webhook_reenviado_com_mesmo_message_id_e_idempotente(mock_storage, settings, company_factory):
    company = company_factory()
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company.id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-certo")
    payload = {
        "arquivo": _arquivo(),
        "email_remetente": "ana@example.com",
        "message_id": "checkmail-123",
    }
    primeira = client.post(URL, payload, format="multipart")
    segunda = client.post(
        URL,
        {**payload, "arquivo": _arquivo()},
        format="multipart",
    )

    assert primeira.status_code == 201
    assert segunda.status_code == 201
    assert primeira.data["id"] == segunda.data["id"]
    assert CandidatoTriagemIA.objects.filter(company=company).count() == 1


@pytest.mark.django_db
def test_webhook_arquivo_muito_grande_retorna_400(settings, company_factory):
    settings.TRIAGEM_IA_WEBHOOK_TOKEN = "token-certo"
    settings.TRIAGEM_IA_WEBHOOK_COMPANY_ID = str(company_factory().id)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer token-certo")
    grande_demais = b"0" * (MAX_ANEXO_WEBHOOK_BYTES + 1)
    response = client.post(
        URL,
        {
            "arquivo": _arquivo(conteudo=grande_demais),
            "email_remetente": "ana@example.com",
        },
        format="multipart",
    )

    assert response.status_code == 400
    assert CandidatoTriagemIA.objects.count() == 0


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_processar_curriculo_webhook_mesmo_arquivo_assuntos_diferentes_nao_colide(
    mock_storage, company_factory
):
    """Sem message_id, o hash de idempotência precisa considerar o assunto
    -- senão o mesmo PDF mandado pra duas vagas diferentes vira "duplicado"
    e a segunda candidatura nunca é criada."""
    company = company_factory()
    conteudo = b"%PDF-1.4 mesmo arquivo"

    primeiro = services.processar_curriculo_webhook(
        company.id,
        email_remetente="ana@example.com",
        nome_remetente="Ana",
        assunto="Candidatura vaga A",
        content_type="application/pdf",
        conteudo=conteudo,
    )
    segundo = services.processar_curriculo_webhook(
        company.id,
        email_remetente="ana@example.com",
        nome_remetente="Ana",
        assunto="Candidatura vaga B",
        content_type="application/pdf",
        conteudo=conteudo,
    )

    assert primeiro.id != segundo.id
    assert CandidatoTriagemIA.objects.filter(company=company).count() == 2


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_processar_curriculo_webhook_corrida_entre_retries_nao_derruba_a_chamada(
    mock_storage, company_factory
):
    """Duas chamadas concorrentes com o mesmo message_id (retry de webhook)
    podem ambas passar pela checagem de duplicado antes de qualquer uma
    criar o registro -- a segunda tem que cair no IntegrityError da
    constraint única e devolver o item já criado, não propagar 500. O
    upload no MinIO (mockado) é o ponto mais tardio antes do
    ``transaction.atomic()`` -- usado aqui pra simular a "outra" requisição
    inserindo o registro concorrente exatamente nesse intervalo."""
    company = company_factory()

    def cria_registro_concorrente(*args, **kwargs):
        CandidatoTriagemIA.objects.create(
            company=company,
            message_id="checkmail-corrida",
            email_remetente="outra@example.com",
        )

    mock_storage.return_value.upload_file.side_effect = cria_registro_concorrente

    resultado = services.processar_curriculo_webhook(
        company.id,
        email_remetente="ana@example.com",
        nome_remetente="Ana",
        assunto="Candidatura",
        content_type="application/pdf",
        conteudo=b"%PDF-1.4 conteudo",
        message_id="checkmail-corrida",
    )

    assert resultado.message_id == "checkmail-corrida"
    assert resultado.email_remetente == "outra@example.com"
    assert CandidatoTriagemIA.objects.filter(company=company).count() == 1
