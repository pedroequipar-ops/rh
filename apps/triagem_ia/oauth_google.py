"""Fluxo OAuth "Conectar com Google" (Gmail) da Triagem por IA.

Sem lib pesada do Google — só REST puro com ``requests``, no mesmo espírito
enxuto do resto do projeto (SDK só quando o provedor não é simples REST).
"""

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
import requests

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

SCOPES = " ".join(
    [
        "https://www.googleapis.com/auth/gmail.modify",
        "openid",
        "email",
    ]
)

STATE_SALT = "triagem_ia.google_oauth"
STATE_MAX_AGE = 600  # 10 minutos pra completar o consentimento


class GoogleOAuthNaoConfiguradoError(Exception):
    pass


class GoogleOAuthError(Exception):
    pass


def _garantir_configurado():
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise GoogleOAuthNaoConfiguradoError(
            "Google ainda não configurado nesta instância (GOOGLE_OAUTH_CLIENT_ID/SECRET)."
        )


def assinar_state(company_id: str, user_id: str) -> str:
    signer = TimestampSigner(salt=STATE_SALT)
    return signer.sign(f"{company_id}:{user_id}")


def ler_state(state: str) -> tuple[str, str]:
    signer = TimestampSigner(salt=STATE_SALT)
    try:
        valor = signer.unsign(state, max_age=STATE_MAX_AGE)
    except SignatureExpired as exc:
        raise GoogleOAuthError("Link de conexão expirado, tente conectar de novo.") from exc
    except BadSignature as exc:
        raise GoogleOAuthError("Link de conexão inválido.") from exc
    company_id, _, user_id = valor.partition(":")
    return company_id, user_id


def montar_url_autorizacao(company_id: str, user_id: str) -> str:
    _garantir_configurado()
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": assinar_state(company_id, user_id),
    }
    query = "&".join(f"{k}={requests.utils.quote(v, safe='')}" for k, v in params.items())
    return f"{AUTHORIZE_URL}?{query}"


def trocar_code_por_tokens(code: str) -> dict:
    _garantir_configurado()
    resp = requests.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise GoogleOAuthError(f"Falha ao trocar code por token: {resp.text}")
    return resp.json()


def renovar_access_token(refresh_token: str) -> dict:
    _garantir_configurado()
    resp = requests.post(
        TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise GoogleOAuthError(f"Falha ao renovar access token: {resp.text}")
    return resp.json()


def buscar_email_da_conta(access_token: str) -> str:
    resp = requests.get(
        USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=15
    )
    if resp.status_code != 200:
        raise GoogleOAuthError(f"Falha ao buscar e-mail da conta Google: {resp.text}")
    return resp.json().get("email", "")
