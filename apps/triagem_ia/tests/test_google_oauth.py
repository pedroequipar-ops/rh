import base64
from email.mime.text import MIMEText
from unittest.mock import Mock, patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.triagem_ia import oauth_google
from apps.triagem_ia.gmail_client import GmailApiClient
from apps.triagem_ia.imap_client import ImapClient
from apps.triagem_ia.models import CaixaEntradaEmail, ProviderCaixaEntrada
from apps.triagem_ia.services import _cliente_para


def _client_for(user, company):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))
    return client


@pytest.mark.django_db
@patch("apps.triagem_ia.oauth_google.settings.GOOGLE_OAUTH_CLIENT_ID", "")
@patch("apps.triagem_ia.oauth_google.settings.GOOGLE_OAUTH_CLIENT_SECRET", "")
def test_authorize_sem_credenciais_configuradas_da_erro_amigavel(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.get("/v1/triagem-ia-google/authorize/")

    assert response.status_code == 400
    assert "Google" in response.data["detail"]


@pytest.mark.django_db
def test_setor_nao_pode_chamar_authorize(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = _client_for(setor_user, company)
    response = client.get("/v1/triagem-ia-google/authorize/")

    assert response.status_code == 403


@pytest.mark.django_db
@patch("apps.triagem_ia.oauth_google.settings.GOOGLE_OAUTH_CLIENT_ID", "fake-client-id")
@patch("apps.triagem_ia.oauth_google.settings.GOOGLE_OAUTH_CLIENT_SECRET", "fake-secret")
def test_authorize_com_credenciais_devolve_url_com_state(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = _client_for(rh, company)
    response = client.get("/v1/triagem-ia-google/authorize/")

    assert response.status_code == 200
    url = response.data["authorize_url"]
    assert "client_id=fake-client-id" in url
    assert "state=" in url


def test_ler_state_rejeita_assinatura_invalida():
    with pytest.raises(oauth_google.GoogleOAuthError):
        oauth_google.ler_state("lixo-invalido")


def test_state_roundtrip():
    assinado = oauth_google.assinar_state("company-1", "user-1")
    company_id, user_id = oauth_google.ler_state(assinado)
    assert company_id == "company-1"
    assert user_id == "user-1"


@pytest.mark.django_db
@patch("apps.triagem_ia.views.oauth_google.buscar_email_da_conta", return_value="vagas@gmail.com")
@patch(
    "apps.triagem_ia.views.oauth_google.trocar_code_por_tokens",
    return_value={"access_token": "tok123", "refresh_token": "refresh123"},
)
def test_callback_sucesso_cria_caixa_google(mock_trocar, mock_userinfo, company_factory):
    company = company_factory()
    state = oauth_google.assinar_state(str(company.id), "user-1")

    client = APIClient()
    response = client.get(f"/v1/triagem-ia-google/callback/?code=abc&state={state}")

    assert response.status_code == 302
    assert "google=conectado" in response.url

    caixa = CaixaEntradaEmail.objects.get(company_id=company.id)
    assert caixa.provider == ProviderCaixaEntrada.GOOGLE
    assert caixa.usuario == "vagas@gmail.com"
    assert caixa.google_refresh_token_cifrado != ""


@pytest.mark.django_db
@patch("apps.triagem_ia.views.oauth_google.buscar_email_da_conta", return_value="vagas@gmail.com")
@patch(
    "apps.triagem_ia.views.oauth_google.trocar_code_por_tokens",
    return_value={"access_token": "tok123", "refresh_token": "refresh123"},
)
def test_callback_reconecta_mesma_conta_atualiza_em_vez_de_duplicar(
    mock_trocar, mock_userinfo, company_factory, caixa_entrada_factory
):
    company = company_factory()
    caixa_existente = caixa_entrada_factory(
        company=company,
        usuario="vagas@gmail.com",
        provider=ProviderCaixaEntrada.GOOGLE,
        google_refresh_token_cifrado="token-antigo-cifrado",
    )
    state = oauth_google.assinar_state(str(company.id), "user-1")

    client = APIClient()
    response = client.get(f"/v1/triagem-ia-google/callback/?code=abc&state={state}")

    assert response.status_code == 302
    assert "google=conectado" in response.url
    assert CaixaEntradaEmail.objects.filter(company_id=company.id).count() == 1
    caixa_existente.refresh_from_db()
    assert caixa_existente.google_refresh_token_cifrado != "token-antigo-cifrado"


@pytest.mark.django_db
@patch(
    "apps.triagem_ia.views.oauth_google.trocar_code_por_tokens",
    return_value={"access_token": "tok123"},  # sem refresh_token
)
def test_callback_sem_refresh_token_redireciona_com_erro(mock_trocar, company_factory):
    company = company_factory()
    state = oauth_google.assinar_state(str(company.id), "user-1")

    client = APIClient()
    response = client.get(f"/v1/triagem-ia-google/callback/?code=abc&state={state}")

    assert response.status_code == 302
    assert "google=erro" in response.url
    assert not CaixaEntradaEmail.objects.filter(company_id=company.id).exists()


@pytest.mark.django_db
def test_callback_com_state_invalido_redireciona_com_erro():
    client = APIClient()
    response = client.get("/v1/triagem-ia-google/callback/?code=abc&state=lixo")

    assert response.status_code == 302
    assert "google=erro" in response.url


@pytest.mark.django_db
def test_callback_com_erro_do_google_redireciona_com_erro():
    client = APIClient()
    response = client.get("/v1/triagem-ia-google/callback/?error=access_denied")

    assert response.status_code == 302
    assert "google=erro" in response.url


def test_cliente_para_escolhe_pelo_provider():
    caixa_imap = CaixaEntradaEmail(provider=ProviderCaixaEntrada.IMAP)
    caixa_google = CaixaEntradaEmail(provider=ProviderCaixaEntrada.GOOGLE)

    assert isinstance(_cliente_para(caixa_imap), ImapClient)
    assert isinstance(_cliente_para(caixa_google), GmailApiClient)


@patch("apps.triagem_ia.gmail_client.requests.get")
def test_gmail_client_decodifica_raw_em_message(mock_get):
    original = MIMEText("corpo do e-mail")
    original["Subject"] = "Teste"
    original["From"] = "candidato@example.com"
    raw_b64url = base64.urlsafe_b64encode(original.as_bytes()).decode().rstrip("=")

    mock_get.return_value = Mock(status_code=200, json=lambda: {"raw": raw_b64url})
    mock_get.return_value.raise_for_status = lambda: None

    caixa = CaixaEntradaEmail(provider=ProviderCaixaEntrada.GOOGLE)
    gmail_client = GmailApiClient(caixa)
    gmail_client._access_token = "tok"

    mensagem = gmail_client.buscar_mensagem("msg-1")

    assert mensagem["Subject"] == "Teste"
    assert mensagem.get_payload() == "corpo do e-mail"
