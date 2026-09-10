from django.db.models import Count, Q

from apps.candidatos.models import Candidato
from apps.vagas import services as vagas_services
from apps.vagas.models import Vaga

S = Vaga.Status

STATUS_ATIVOS = {S.SOLICITADA, S.APROVADA, S.PUBLICADA, S.ENCERRADA, S.EM_TRIAGEM, S.CONGELADA}

LIMITE_ATRASADAS = 10


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
