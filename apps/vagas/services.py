"""Máquina de estados da vaga (fluxo pré-triagem) e cobrança.

Centraliza transições de ``Vaga.status``: valida contra ``ALLOWED_TRANSITIONS`` +
papel do usuário, aplica carimbos automáticos, grava ``VagaHistoricoStatus`` e
dispara notificações. Espelha o padrão de ``apps/candidatos/services.py``.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.atividade import services as atividade_services

from .models import EtapaKanban, Vaga, VagaCobranca, VagaHistoricoStatus, VagaNotificacao

S = Vaga.Status

HORAS_PARA_EXCLUIR_ENCERRADA = 12

ALLOWED_TRANSITIONS = {
    S.RASCUNHO: {S.SOLICITADA, S.CANCELADA},
    S.SOLICITADA: {S.APROVADA, S.RECUSADA, S.CANCELADA},
    S.RECUSADA: {S.SOLICITADA, S.CANCELADA},
    S.APROVADA: {S.PUBLICADA, S.CONGELADA, S.CANCELADA},
    S.PUBLICADA: {S.ENCERRADA, S.EM_TRIAGEM, S.CONGELADA, S.CANCELADA, S.PREENCHIDA},
    S.ENCERRADA: {S.EM_TRIAGEM, S.PUBLICADA, S.CANCELADA},
    S.EM_TRIAGEM: {S.PREENCHIDA, S.CANCELADA},
    S.CONGELADA: {S.CANCELADA},
    S.CANCELADA: set(),
    S.PREENCHIDA: set(),
}

# Transições que um usuário SETOR pode disparar (de, para). Todo o resto é RH.
SETOR_ALLOWED = {
    (S.RASCUNHO, S.SOLICITADA),
    (S.RECUSADA, S.SOLICITADA),
    (S.RASCUNHO, S.CANCELADA),
    (S.SOLICITADA, S.CANCELADA),
    (S.RECUSADA, S.CANCELADA),
}

# Status ativos onde um prazo estourado ainda faz sentido alertar.
STATUS_PRAZO_ATIVO = {S.APROVADA, S.PUBLICADA, S.ENCERRADA, S.EM_TRIAGEM}

STAMP_FIELDS = {
    S.SOLICITADA: "solicitada_em",
    S.APROVADA: "aprovada_em",
    S.RECUSADA: "recusada_em",
    S.PUBLICADA: "publicada_em",
    S.ENCERRADA: "encerrada_em",
    S.EM_TRIAGEM: "triagem_iniciada_em",
}
FECHAMENTO = {S.PREENCHIDA, S.CANCELADA}

# Status em que a bola está com o RH / com o setor solicitante.
RESPONSAVEL_RH = {S.SOLICITADA, S.APROVADA, S.PUBLICADA, S.ENCERRADA}
RESPONSAVEL_SETOR = {S.RASCUNHO, S.RECUSADA}


def _is_rh(user) -> bool:
    return bool(user and (user.is_superuser or getattr(user, "role", None) == User.Role.RH))


def can_access_vaga(user, vaga) -> bool:
    """RH/superuser veem qualquer vaga; SETOR só as do próprio setor."""
    if _is_rh(user):
        return True
    if getattr(user, "role", None) == User.Role.SETOR:
        return str(vaga.setor_id) == str(user.setor_id)
    return False


def _destinos_validos(vaga) -> set:
    destinos = set(ALLOWED_TRANSITIONS.get(vaga.status, set()))
    if vaga.status == S.CONGELADA and vaga.status_pre_congelamento:
        destinos.add(vaga.status_pre_congelamento)
    return destinos


def transicoes_disponiveis(vaga, user) -> list:
    """Destinos que ``user`` pode disparar a partir do status atual da vaga."""
    destinos = _destinos_validos(vaga)
    if _is_rh(user):
        return sorted(destinos)
    return sorted(d for d in destinos if (vaga.status, d) in SETOR_ALLOWED)


def _notificar(company_id, destinatarios, vaga, mensagem):
    VagaNotificacao.objects.bulk_create(
        [
            VagaNotificacao(
                company_id=company_id, destinatario=u, vaga=vaga, mensagem=mensagem
            )
            for u in destinatarios
        ]
    )


def notificar_vaga_criada(vaga, company_id):
    """Notifica todos os RH ativos que uma nova solicitação de vaga chegou."""
    destinatarios = User.objects.filter(
        company_id=company_id, role=User.Role.RH, is_active=True
    )
    _notificar(
        company_id,
        destinatarios,
        vaga,
        f'Setor "{vaga.setor.nome}" solicitou a vaga "{vaga.titulo}"',
    )


def _prazo_estourado(vaga, hoje=None):
    hoje = hoje or timezone.localdate()
    if vaga.status not in STATUS_PRAZO_ATIVO:
        return False
    return bool(
        (vaga.data_alvo_preenchimento and vaga.data_alvo_preenchimento < hoje)
        or (vaga.data_inicio_prevista and vaga.data_inicio_prevista < hoje)
    )


def atrasada_q(hoje=None) -> Q:
    """Equivalente a `_prazo_estourado`, mas como `Q` pra filtrar/contar no
    banco (dashboard) em vez de carregar tudo em Python. Mantida em paridade
    com `_prazo_estourado` — ver teste de paridade em apps/dashboard."""
    hoje = hoje or timezone.localdate()
    return Q(status__in=STATUS_PRAZO_ATIVO) & (
        Q(data_alvo_preenchimento__lt=hoje) | Q(data_inicio_prevista__lt=hoje)
    )


def alertar_vagas_com_prazo_estourado():
    """Cria uma notificação (uma vez) para cada vaga ativa cujo prazo de
    preenchimento ou de início previsto já passou. Roda por cron do SO."""
    hoje = timezone.localdate()
    total = 0
    vagas = Vaga.objects.filter(
        status__in=STATUS_PRAZO_ATIVO, prazo_alertado_em__isnull=True
    ).select_related("setor")
    for vaga in vagas:
        if not _prazo_estourado(vaga, hoje):
            continue
        now = timezone.now()
        vaga.prazo_alertado_em = now
        vaga.save(update_fields=["prazo_alertado_em", "updated_at"])
        registrar_historico(vaga, "", vaga.status, None, "Prazo da vaga estourado")
        _notificar(
            vaga.company_id,
            User.objects.filter(
                company_id=vaga.company_id, role=User.Role.RH, is_active=True
            ),
            vaga,
            f'Vaga "{vaga.titulo}" passou do prazo de preenchimento/início.',
        )
        total += 1
    return total


def limpar_alerta_prazo_se_futuro(vaga):
    """Zera o carimbo de alerta quando as datas voltam a ficar no futuro,
    para o alerta poder disparar de novo se estourar outra vez."""
    if not vaga.prazo_alertado_em:
        return
    if not _prazo_estourado(vaga):
        vaga.prazo_alertado_em = None
        vaga.save(update_fields=["prazo_alertado_em", "updated_at"])


def excluir_encerradas_vencidas(company_id) -> int:
    """"Lixeira" da vaga: quem fica em ENCERRADA por mais de 12h é excluída
    (soft delete). Checado sob demanda (a cada listagem), igual ao padrão de
    `apps/candidatos/services.excluir_reprovados_vencidos`."""
    limite = timezone.now() - timedelta(hours=HORAS_PARA_EXCLUIR_ENCERRADA)
    vencidas = Vaga.objects.filter(
        company_id=company_id,
        status=S.ENCERRADA,
        encerrada_em__lte=limite,
    )
    return vencidas.update(active=False, updated_at=timezone.now())


def etapa_triagem_inicial(company_id):
    """Primeira etapa do kanban que ainda não exige cadastro completo."""
    return (
        EtapaKanban.objects.filter(
            company_id=company_id, is_saida_negativa=False, exige_cadastro_completo=False
        )
        .order_by("ordem")
        .first()
    )


def mover_vaga_etapa(vaga, etapa, user):
    """Move o card da vaga entre etapas de triagem (pré-cadastro).

    Só vale enquanto a vaga está em EM_TRIAGEM e para etapas que ainda não
    exigem cadastro completo — a partir dessas, quem circula é o Candidato.
    """
    if vaga.status != Vaga.Status.EM_TRIAGEM:
        raise ValidationError({"detail": "A vaga não está em triagem."})
    if etapa.company_id != vaga.company_id:
        raise ValidationError({"detail": "Etapa de outra empresa."})
    if etapa.exige_cadastro_completo:
        raise ValidationError(
            {"detail": "Essa etapa exige cadastrar a pessoa; use o cadastro de candidato."}
        )
    vaga.etapa_atual = etapa
    vaga.save(update_fields=["etapa_atual", "updated_at"])
    registrar_historico(
        vaga, "", S.EM_TRIAGEM, user, f"card da vaga movido para {etapa.nome}"
    )
    atividade_services.registrar(
        user, "moveu_etapa_triagem", vaga, resumo=f'moveu o card para "{etapa.nome}"'
    )
    return vaga


def registrar_edicao(vaga, user):
    """Chamado pela view depois de um PATCH de campo (fora de transição)."""
    atividade_services.registrar(user, "editou", vaga, resumo="editou os dados da vaga")


def registrar_mudanca_responsavel(vaga, antes, depois, user):
    if depois is None:
        resumo = "removeu o responsável"
    elif antes is None:
        resumo = f"definiu {depois.username} como responsável"
    else:
        resumo = f"trocou o responsável para {depois.username}"
    atividade_services.registrar(user, "mudou_responsavel", vaga, resumo=resumo)


def registrar_historico(vaga, de_status, para_status, user, observacao=""):
    VagaHistoricoStatus.objects.create(
        company_id=vaga.company_id,
        vaga=vaga,
        de_status=de_status or "",
        para_status=para_status,
        por=user if (user and not user.is_anonymous) else None,
        observacao=observacao or "",
    )


def registrar_candidaturas_recebidas(vaga, quantidade, user):
    """RH informa quantas pessoas mandaram currículo enquanto a vaga está
    publicada. Atualiza ``qtd_pessoas_fase`` e grava no histórico."""
    if vaga.status != S.PUBLICADA:
        raise ValidationError(
            {"detail": "Só dá para registrar candidaturas com a vaga publicada."}
        )
    try:
        quantidade = int(quantidade)
    except (TypeError, ValueError):
        raise ValidationError({"quantidade": "Valor inválido."})
    if quantidade < 0:
        raise ValidationError({"quantidade": "Valor inválido."})

    delta = quantidade - (vaga.qtd_pessoas_fase or 0)
    vaga.qtd_pessoas_fase = quantidade
    vaga.save(update_fields=["qtd_pessoas_fase", "updated_at"])

    obs = f"Candidaturas recebidas: {quantidade}"
    if delta > 0:
        obs += f" (+{delta})"
    registrar_historico(vaga, "", S.PUBLICADA, user, obs)
    atividade_services.registrar(
        user, "registrou_candidaturas", vaga, resumo=f"registrou {quantidade} candidatura(s) recebida(s)"
    )
    return vaga


def aplicar_transicao(vaga, para, user, observacao="", *, extra_fields=None, checar_papel=True):
    """Move ``vaga`` para o status ``para``.

    Valida a transição contra ``ALLOWED_TRANSITIONS`` (e o papel do usuário quando
    ``checar_papel``), aplica carimbos, salva, grava histórico e dispara
    notificações. Levanta ``ValidationError`` (transição inválida) ou
    ``PermissionDenied`` (papel sem permissão).
    """
    para = str(para)
    de = vaga.status

    if para not in Vaga.Status.values:
        raise ValidationError({"para": "Status inválido."})
    if para == de:
        raise ValidationError({"para": "A vaga já está nesse status."})
    if para not in _destinos_validos(vaga):
        raise ValidationError(
            {"para": f'Transição não permitida de "{de}" para "{para}".'}
        )
    if checar_papel and not _is_rh(user) and (de, para) not in SETOR_ALLOWED:
        raise PermissionDenied("Seu perfil não pode fazer essa transição.")

    now = timezone.now()
    campos = {"status": para, "updated_at": now}

    if para == S.CONGELADA:
        vaga.status_pre_congelamento = de
        campos["status_pre_congelamento"] = de
    elif de == S.CONGELADA:
        vaga.status_pre_congelamento = ""
        campos["status_pre_congelamento"] = ""

    stamp = STAMP_FIELDS.get(para)
    if stamp and getattr(vaga, stamp) is None:
        setattr(vaga, stamp, now)
        campos[stamp] = now
    if para == S.EM_TRIAGEM and vaga.etapa_atual_id is None:
        etapa = etapa_triagem_inicial(vaga.company_id)
        if etapa is not None:
            vaga.etapa_atual = etapa
            campos["etapa_atual"] = etapa
    if para in FECHAMENTO and vaga.fechada_em is None:
        vaga.fechada_em = now
        campos["fechada_em"] = now
    if para == S.APROVADA and user and not user.is_anonymous:
        vaga.aprovada_por = user
        campos["aprovada_por"] = user

    for field, value in (extra_fields or {}).items():
        setattr(vaga, field, value)
        campos[field] = value

    vaga.status = para
    vaga.save(update_fields=list(campos.keys()))

    registrar_historico(vaga, de, para, user, observacao)
    atividade_services.registrar(
        user, "mudou_status", vaga, resumo=f'mudou o status para "{vaga.get_status_display()}"'
    )

    if para == S.SOLICITADA:
        notificar_vaga_criada(vaga, vaga.company_id)
    elif para == S.RECUSADA:
        _notificar(
            vaga.company_id,
            User.objects.filter(id=vaga.criado_por_id, is_active=True),
            vaga,
            f'Vaga "{vaga.titulo}" foi recusada: {vaga.motivo_recusa or "sem motivo"}',
        )

    return vaga


def cobrar_vaga(vaga, autor, mensagem=""):
    """Cobrança bidirecional: quem não é o responsável da etapa cobra quem é."""
    if vaga.status in RESPONSAVEL_RH:
        alvo_role = User.Role.RH
    elif vaga.status in RESPONSAVEL_SETOR:
        alvo_role = User.Role.SETOR
    else:
        raise ValidationError(
            {"detail": "Vaga nesse status não tem responsável a cobrar."}
        )

    if getattr(autor, "role", None) == alvo_role and not autor.is_superuser:
        raise ValidationError(
            {"detail": "Você é o responsável por essa etapa; não há quem cobrar."}
        )
    if getattr(autor, "role", None) == User.Role.SETOR and vaga.setor_id != autor.setor_id:
        raise PermissionDenied("Você só pode cobrar vagas do seu setor.")

    alvos = User.objects.filter(
        company_id=vaga.company_id, role=alvo_role, is_active=True
    ).exclude(id=autor.id)
    if alvo_role == User.Role.SETOR:
        alvos = alvos.filter(setor_id=vaga.setor_id)
    alvos = list(alvos)
    if not alvos:
        raise ValidationError({"detail": "Nenhum destinatário para a cobrança."})

    now = timezone.now()
    VagaCobranca.objects.bulk_create(
        [
            VagaCobranca(
                company_id=vaga.company_id,
                vaga=vaga,
                de_usuario=autor,
                para_usuario=alvo,
                status_no_momento=vaga.status,
                mensagem=mensagem or "",
            )
            for alvo in alvos
        ]
    )
    texto = f'Cobrança na vaga "{vaga.titulo}" (etapa {vaga.get_status_display()})'
    if mensagem:
        texto = f"{texto}: {mensagem}"
    _notificar(vaga.company_id, alvos, vaga, texto)

    vaga.cobrada_em = now
    vaga.total_cobrancas = (vaga.total_cobrancas or 0) + len(alvos)
    vaga.save(update_fields=["cobrada_em", "total_cobrancas", "updated_at"])
    atividade_services.registrar(
        autor, "cobrou_responsavel", vaga, resumo=f"cobrou o responsável ({len(alvos)} pessoa(s))"
    )
    return len(alvos)
