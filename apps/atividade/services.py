import re

from apps.accounts.models import User
from utils.whatsapp import notificar_whatsapp

from .models import AlvoTipo, Atividade, Comentario

MENCAO_RE = re.compile(r"@(\w+)")


def _alvo_tipo(alvo) -> str:
    from apps.candidatos.models import Candidato
    from apps.vagas.models import Vaga

    if isinstance(alvo, Vaga):
        return AlvoTipo.VAGA
    if isinstance(alvo, Candidato):
        return AlvoTipo.CANDIDATO
    raise ValueError(f"Alvo não suportado pra atividade: {type(alvo)}")


def registrar(ator, verbo, alvo, *, resumo, **dados):
    """Grava uma entrada append-only de atividade pra `alvo` (Vaga ou Candidato)."""
    alvo_tipo = _alvo_tipo(alvo)
    Atividade.objects.create(
        company_id=alvo.company_id,
        ator=ator if (ator and not ator.is_anonymous) else None,
        verbo=verbo,
        alvo_tipo=alvo_tipo,
        alvo_id=alvo.id,
        resumo=resumo,
        dados=dados,
    )

    responsavel = getattr(alvo, "responsavel", None)
    if responsavel and (not ator or responsavel.id != ator.id):
        notificar_whatsapp(
            responsavel,
            alvo_tipo=alvo_tipo.lower(),
            alvo_id=alvo.id,
            titulo="Atualização",
            texto=resumo,
            sender=getattr(ator, "username", "") if ator else "",
        )


def _notificar_mencoes(autor, mencionados, alvo, texto):
    from apps.candidatos.models import Candidato, CandidatoNotificacao
    from apps.core.notificacoes_ws import publicar_notificacao
    from apps.vagas.models import Vaga, VagaNotificacao

    mencionados = list(mencionados)
    resumo = texto if len(texto) <= 140 else f"{texto[:137]}..."
    mensagem = f'{autor.username} mencionou você: "{resumo}"'

    if isinstance(alvo, Vaga):
        VagaNotificacao.objects.bulk_create(
            [
                VagaNotificacao(company_id=alvo.company_id, destinatario=u, vaga=alvo, mensagem=mensagem)
                for u in mencionados
            ]
        )
        for u in mencionados:
            publicar_notificacao(u.id, "vaga", {"mensagem": mensagem, "vaga_id": str(alvo.id)})
    elif isinstance(alvo, Candidato):
        CandidatoNotificacao.objects.bulk_create(
            [
                CandidatoNotificacao(
                    company_id=alvo.company_id, destinatario=u, candidato=alvo, mensagem=mensagem
                )
                for u in mencionados
            ]
        )
        for u in mencionados:
            publicar_notificacao(u.id, "candidato", {"mensagem": mensagem, "candidato_id": str(alvo.id)})


def criar_comentario(autor, alvo, texto: str) -> Comentario:
    comentario = Comentario.objects.create(
        company_id=alvo.company_id,
        autor=autor,
        alvo_tipo=_alvo_tipo(alvo),
        alvo_id=alvo.id,
        texto=texto,
    )

    usernames = set(MENCAO_RE.findall(texto))
    if usernames:
        mencionados = list(
            User.objects.filter(company_id=alvo.company_id, username__in=usernames).exclude(
                id=autor.id
            )
        )
        if mencionados:
            comentario.mencoes.set(mencionados)
            _notificar_mencoes(autor, mencionados, alvo, texto)

    return comentario
