"""Cifra/decifra a senha da caixa de e-mail (``CaixaEntradaEmail.senha_cifrada``).

Primeiro segredo armazenado no projeto — por isso usa uma chave Fernet
dedicada (``TRIAGEM_IA_ENCRYPTION_KEY``), não derivada de ``SECRET_KEY``, pra
poder ser rotacionada sem mexer na chave de sessão/JWT.
"""

from cryptography.fernet import Fernet
from django.conf import settings


class ChaveTriagemIaNaoConfiguradaError(Exception):
    pass


def _fernet() -> Fernet:
    chave = settings.TRIAGEM_IA_ENCRYPTION_KEY
    if not chave:
        raise ChaveTriagemIaNaoConfiguradaError(
            "TRIAGEM_IA_ENCRYPTION_KEY não configurada."
        )
    return Fernet(chave.encode() if isinstance(chave, str) else chave)


def cifrar(texto_plano: str) -> str:
    if not texto_plano:
        return ""
    return _fernet().encrypt(texto_plano.encode()).decode()


def decifrar(texto_cifrado: str) -> str:
    if not texto_cifrado:
        return ""
    return _fernet().decrypt(texto_cifrado.encode()).decode()
