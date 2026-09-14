"""Wrapper fino sobre ``imaplib``/``email`` (stdlib, sem lib nova) pra ler a
caixa de entrada configurada em ``CaixaEntradaEmail``. Ver
``services.ingerir_todas_caixas`` pro uso completo (dedupe, roteamento,
extração de anexo)."""

import email
import imaplib
from email.message import Message

from . import crypto
from .models import CaixaEntradaEmail

CONTENT_TYPES_ACEITOS = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


class ImapClient:
    def __init__(self, caixa: CaixaEntradaEmail):
        self.caixa = caixa
        self._conn = None

    def conectar(self):
        senha = crypto.decifrar(self.caixa.senha_cifrada)
        if self.caixa.usar_ssl:
            conn = imaplib.IMAP4_SSL(self.caixa.host, self.caixa.porta)
        else:
            conn = imaplib.IMAP4(self.caixa.host, self.caixa.porta)
        conn.login(self.caixa.usuario, senha)
        conn.select(self.caixa.pasta)
        self._conn = conn
        return conn

    def fechar(self):
        if self._conn is None:
            return
        try:
            self._conn.close()
            self._conn.logout()
        except Exception:
            pass
        self._conn = None

    def buscar_nao_lidos(self, limite: int = 50) -> list:
        status, dados = self._conn.search(None, "UNSEEN")
        if status != "OK":
            return []
        uids = dados[0].split()
        return uids[:limite]

    def buscar_mensagem(self, uid) -> Message:
        status, dados = self._conn.fetch(uid, "(RFC822)")
        if status != "OK" or not dados or dados[0] is None:
            raise ValueError(f"Não foi possível buscar a mensagem {uid!r}.")
        raw = dados[0][1]
        return email.message_from_bytes(raw)

    def marcar_lida(self, uid):
        self._conn.store(uid, "+FLAGS", "\\Seen")


def extrair_anexos(mensagem: Message) -> list:
    """Devolve [(filename, content_type, bytes), ...] pros anexos aceitos
    (PDF/.docx/.doc). Outros tipos são ignorados aqui — quem decide o que
    fazer com "nenhum anexo aceito" é ``services.py`` (vira status ERRO)."""
    anexos = []
    for parte in mensagem.walk():
        content_type = (parte.get_content_type() or "").lower()
        disposicao = str(parte.get("Content-Disposition") or "")
        filename = parte.get_filename()
        if content_type not in CONTENT_TYPES_ACEITOS:
            continue
        if not filename and "attachment" not in disposicao.lower():
            continue
        conteudo = parte.get_payload(decode=True)
        if not conteudo:
            continue
        anexos.append((filename or "curriculo", content_type, conteudo))
    return anexos
