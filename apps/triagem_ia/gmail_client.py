"""Cliente Gmail API — mesma interface pública de ``imap_client.ImapClient``
(``conectar``/``buscar_nao_lidos``/``buscar_mensagem``/``marcar_lida``/``fechar``),
pra ``services.ingerir_todas_caixas`` usar qualquer um dos dois sem saber a
diferença. ``buscar_mensagem`` devolve um ``email.message.Message`` de
verdade (decodificado do "raw" da API), então ``imap_client.extrair_anexos``
funciona sem alteração pros dois provedores.
"""

import base64
import email
from email.message import Message

import requests

from . import crypto, oauth_google
from .models import CaixaEntradaEmail

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class GmailApiClient:
    def __init__(self, caixa: CaixaEntradaEmail):
        self.caixa = caixa
        self._access_token = None

    def conectar(self):
        refresh_token = crypto.decifrar(self.caixa.google_refresh_token_cifrado)
        tokens = oauth_google.renovar_access_token(refresh_token)
        self._access_token = tokens["access_token"]
        return self._access_token

    def fechar(self):
        self._access_token = None

    def _headers(self):
        return {"Authorization": f"Bearer {self._access_token}"}

    def buscar_nao_lidos(self, limite: int = 50) -> list:
        resp = requests.get(
            f"{GMAIL_API_BASE}/messages",
            headers=self._headers(),
            params={"q": "is:unread", "maxResults": limite},
            timeout=15,
        )
        resp.raise_for_status()
        return [m["id"] for m in resp.json().get("messages", [])]

    def buscar_mensagem(self, uid) -> Message:
        resp = requests.get(
            f"{GMAIL_API_BASE}/messages/{uid}",
            headers=self._headers(),
            params={"format": "raw"},
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json()["raw"]
        # Gmail usa base64url sem padding — completa o "=" que faltar.
        raw += "=" * (-len(raw) % 4)
        conteudo = base64.urlsafe_b64decode(raw.encode())
        return email.message_from_bytes(conteudo)

    def marcar_lida(self, uid):
        resp = requests.post(
            f"{GMAIL_API_BASE}/messages/{uid}/modify",
            headers=self._headers(),
            json={"removeLabelIds": ["UNREAD"]},
            timeout=15,
        )
        resp.raise_for_status()
