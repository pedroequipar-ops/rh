from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum, Window
from django.db.models.functions import Lead, TruncWeek
from django.utils import timezone

from apps.candidatos.models import Candidato
from apps.chat.models import ChatMensagem
from apps.vagas import services as vagas_services
from apps.vagas.models import Vaga, VagaHistoricoStatus

S = Vaga.Status

STATUS_ATIVOS = {S.SOLICITADA, S.APROVADA, S.PUBLICADA, S.ENCERRADA, S.EM_TRIAGEM, S.CONGELADA}

LIMITE_ATRASADAS = 10
LIMITE_TOP_COBRANCAS = 5
SEMANAS_SERIE = 8


def _escopo_vagas(company_id, setor_id=None, inicio=None, fim=None):
    qs = Vaga.objects.filter(company_id=company_id)
    if setor_id:
        qs = qs.filter(setor_id=setor_id)
    if inicio:
        qs = qs.filter(created_at__date__gte=inicio)
    if fim:
        qs = qs.filter(created_at__date__lte=fim)
    return qs


def _escopo_candidatos(company_id, setor_id=None):
    qs = Candidato.objects.filter(company_id=company_id, active=True)
    if setor_id:
        qs = qs.filter(vaga__setor_id=setor_id)
    return qs


def resumo_vagas(company_id, setor_id=None, inicio=None, fim=None) -> dict:
    qs = _escopo_vagas(company_id, setor_id, inicio, fim)
    return {
        "ativas": qs.filter(status__in=STATUS_ATIVOS).count(),
        "aguardando_aprovacao": qs.filter(status=S.SOLICITADA).count(),
        "preenchidas": qs.filter(status=S.PREENCHIDA).count(),
        "atrasadas": qs.filter(vagas_services.atrasada_q()).count(),
    }


def vagas_por_status(company_id, setor_id=None, inicio=None, fim=None) -> list[dict]:
    qs = _escopo_vagas(company_id, setor_id, inicio, fim)
    contagem = dict(qs.values_list("status").annotate(total=Count("id")).values_list("status", "total"))
    return [
        {"status": status, "status_display": label, "total": contagem.get(status, 0)}
        for status, label in Vaga.Status.choices
    ]


def vagas_ativas_por_setor(company_id, setor_id=None, limite=8) -> list[dict]:
    """Vagas em status ativo agrupadas por setor, maiores volumes primeiro."""
    qs = (
        _escopo_vagas(company_id, setor_id)
        .filter(status__in=STATUS_ATIVOS)
        .values("setor__nome")
        .annotate(total=Count("id"))
        .order_by("-total", "setor__nome")[:limite]
    )
    return [{"setor": r["setor__nome"], "total": r["total"]} for r in qs]


def vagas_atrasadas(company_id, setor_id=None, limite=LIMITE_ATRASADAS) -> list[dict]:
    qs = (
        _escopo_vagas(company_id, setor_id)
        .filter(vagas_services.atrasada_q())
        .select_related("setor")
        .order_by("data_alvo_preenchimento", "data_inicio_prevista")[:limite]
    )
    return [
        {
            "id": str(v.id),
            "titulo": v.titulo,
            "setor": v.setor.nome,
            "status": v.status,
            "data_inicio_prevista": v.data_inicio_prevista,
            "data_alvo_preenchimento": v.data_alvo_preenchimento,
        }
        for v in qs
    ]


def funil_etapas(company_id, setor_id=None) -> list[dict]:
    qs = _escopo_candidatos(company_id, setor_id)
    rows = (
        qs.values("etapa_atual__id", "etapa_atual__nome", "etapa_atual__ordem", "etapa_atual__is_saida_negativa")
        .annotate(total=Count("id"))
        .order_by("etapa_atual__ordem")
    )
    return [
        {
            "etapa_id": str(r["etapa_atual__id"]),
            "nome": r["etapa_atual__nome"],
            "ordem": r["etapa_atual__ordem"],
            "is_saida_negativa": r["etapa_atual__is_saida_negativa"],
            "total": r["total"],
        }
        for r in rows
    ]


def tempo_medio_por_status(company_id, setor_id=None) -> list[dict]:
    """Horas médias que as vagas passam em cada status, medidas pelo
    intervalo entre transições consecutivas em VagaHistoricoStatus (LEAD por
    vaga, ordenado por data)."""
    vagas_qs = _escopo_vagas(company_id, setor_id)
    historico = (
        VagaHistoricoStatus.objects.filter(company_id=company_id, vaga__in=vagas_qs)
        .annotate(
            proximo_created_at=Window(
                expression=Lead("created_at"),
                partition_by=F("vaga_id"),
                order_by=F("created_at").asc(),
            )
        )
        .values("para_status", "created_at", "proximo_created_at")
        .order_by("vaga_id", "created_at")
    )

    somas: dict[str, float] = {}
    contagens: dict[str, int] = {}
    for row in historico:
        status = row["para_status"]
        if not status or row["proximo_created_at"] is None:
            continue
        horas = (row["proximo_created_at"] - row["created_at"]).total_seconds() / 3600
        somas[status] = somas.get(status, 0.0) + horas
        contagens[status] = contagens.get(status, 0) + 1

    status_labels = dict(Vaga.Status.choices)
    return [
        {
            "status": status,
            "status_display": status_labels.get(status, status),
            "horas_media": round(somas[status] / contagens[status], 1),
            "amostras": contagens[status],
        }
        for status in somas
    ]


def tempo_medio_preenchimento(company_id, setor_id=None) -> float | None:
    """Horas médias entre a criação da vaga e o fechamento como PREENCHIDA."""
    qs = _escopo_vagas(company_id, setor_id).filter(status=S.PREENCHIDA, fechada_em__isnull=False)
    resultado = qs.annotate(
        duracao=ExpressionWrapper(F("fechada_em") - F("created_at"), output_field=DurationField())
    ).aggregate(media=Avg("duracao"))
    media = resultado["media"]
    return round(media.total_seconds() / 3600, 1) if media else None


def cobrancas(company_id, setor_id=None, limite=LIMITE_TOP_COBRANCAS) -> dict:
    qs = _escopo_vagas(company_id, setor_id)
    total = qs.aggregate(total=Sum("total_cobrancas"))["total"] or 0
    top = qs.filter(total_cobrancas__gt=0).order_by("-total_cobrancas")[:limite]
    return {
        "total": total,
        "top_vagas": [
            {"id": str(v.id), "titulo": v.titulo, "total_cobrancas": v.total_cobrancas} for v in top
        ],
    }


def chats_sem_resposta(company_id, user_role, setor_id=None) -> int:
    """Conversas (de vaga ou de candidato) cuja última mensagem foi do "outro
    lado" (RH↔Setor) e ainda não foi respondida por `user_role`."""
    from django.db.models import OuterRef, Subquery

    outro_role = "SETOR" if user_role == "RH" else "RH"

    ultima_vaga = ChatMensagem.objects.filter(vaga=OuterRef("pk")).order_by("-created_at")
    vagas_pendentes = (
        _escopo_vagas(company_id, setor_id)
        .annotate(ultimo_autor_role=Subquery(ultima_vaga.values("autor__role")[:1]))
        .filter(ultimo_autor_role=outro_role)
        .count()
    )

    ultima_cand = ChatMensagem.objects.filter(candidato=OuterRef("pk")).order_by("-created_at")
    candidatos_pendentes = (
        _escopo_candidatos(company_id, setor_id)
        .annotate(ultimo_autor_role=Subquery(ultima_cand.values("autor__role")[:1]))
        .filter(ultimo_autor_role=outro_role)
        .count()
    )

    return vagas_pendentes + candidatos_pendentes


def vagas_series(company_id, setor_id=None, semanas=SEMANAS_SERIE) -> list[dict]:
    """Vagas criadas x preenchidas por semana (segunda a domingo), nas últimas
    `semanas` semanas incluindo a atual."""
    hoje = timezone.localdate()
    semana_atual = hoje - timedelta(days=hoje.weekday())
    baldes = [semana_atual - timedelta(weeks=i) for i in range(semanas - 1, -1, -1)]
    inicio = baldes[0]
    base = _escopo_vagas(company_id, setor_id)

    def _por_semana(qs, campo):
        return {
            row["semana"].date(): row["total"]
            for row in (
                qs.annotate(semana=TruncWeek(campo)).values("semana").annotate(total=Count("id"))
            )
            if row["semana"] is not None
        }

    criadas = _por_semana(base.filter(created_at__date__gte=inicio), "created_at")
    preenchidas = _por_semana(
        base.filter(status=S.PREENCHIDA, fechada_em__date__gte=inicio), "fechada_em"
    )
    return [
        {
            "semana": s.isoformat(),
            "criadas": criadas.get(s, 0),
            "preenchidas": preenchidas.get(s, 0),
        }
        for s in baldes
    ]


def candidaturas_vs_cadastrados(company_id, setor_id=None) -> list[dict]:
    """Vagas publicadas: candidaturas informadas (`qtd_pessoas_fase`) vs
    pessoas de fato cadastradas (`Candidato`) por vaga."""
    qs = _escopo_vagas(company_id, setor_id).filter(status=S.PUBLICADA).annotate(
        cadastrados=Count("candidatos", filter=Q(candidatos__active=True))
    )
    return [
        {
            "vaga_id": str(v.id),
            "titulo": v.titulo,
            "candidaturas": v.qtd_pessoas_fase,
            "cadastrados": v.cadastrados,
        }
        for v in qs
    ]
