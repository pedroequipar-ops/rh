"""Relatório personalizado: whitelist de campos/filtros por entidade + a
lógica pra montar o queryset e gerar as linhas. Espelha (em espírito) o
`lib/filtros.ts` do frontend — mesmas chaves de filtro por entidade."""

from collections import Counter
from datetime import date, datetime

from apps.candidatos.models import Candidato
from apps.vagas import services as vagas_services
from apps.vagas.models import Vaga


def _resolver(*atributos):
    def resolver(obj):
        for atributo in atributos:
            if obj is None:
                return ""
            obj = getattr(obj, atributo, "")
            if callable(obj):
                obj = obj()
        return obj

    return resolver


CAMPOS_PERMITIDOS = {
    "vaga": {
        "titulo": {"label": "Título", "resolver": _resolver("titulo")},
        "setor": {"label": "Setor", "resolver": _resolver("setor", "nome")},
        "status": {"label": "Status", "resolver": _resolver("get_status_display")},
        "prioridade": {"label": "Prioridade", "resolver": _resolver("get_prioridade_display")},
        "urgente": {"label": "Urgente", "resolver": lambda v: "Sim" if v.urgente else "Não"},
        "motivo_solicitacao": {
            "label": "Motivo",
            "resolver": _resolver("get_motivo_solicitacao_display"),
        },
        "quantidade_vagas": {"label": "Quantidade", "resolver": _resolver("quantidade_vagas")},
        "salario": {"label": "Salário", "resolver": _resolver("salario")},
        "data_inicio_prevista": {
            "label": "Início previsto",
            "resolver": _resolver("data_inicio_prevista"),
        },
        "data_alvo_preenchimento": {
            "label": "Prazo p/ preencher",
            "resolver": _resolver("data_alvo_preenchimento"),
        },
        "atrasada": {
            "label": "Atrasada",
            "resolver": lambda v: "Sim" if vagas_services._prazo_estourado(v) else "Não",
        },
        "responsavel": {
            "label": "Responsável",
            "resolver": lambda v: v.responsavel.username if v.responsavel_id else "",
        },
        "criado_por": {"label": "Criado por", "resolver": _resolver("criado_por", "username")},
        "total_candidatos": {"label": "Total de candidatos", "resolver": lambda v: v.candidatos.count()},
        "created_at": {"label": "Criada em", "resolver": _resolver("created_at")},
    },
    "candidato": {
        "nome": {"label": "Nome", "resolver": _resolver("nome")},
        "email": {"label": "Email", "resolver": _resolver("email")},
        "telefone": {"label": "Telefone", "resolver": _resolver("telefone")},
        "cpf": {"label": "CPF", "resolver": _resolver("cpf")},
        "vaga": {"label": "Vaga", "resolver": _resolver("vaga", "titulo")},
        "vaga_setor": {"label": "Setor da vaga", "resolver": _resolver("vaga", "setor", "nome")},
        "etapa_atual": {"label": "Etapa", "resolver": _resolver("etapa_atual", "nome")},
        "responsavel": {
            "label": "Responsável",
            "resolver": lambda c: c.responsavel.username if c.responsavel_id else "",
        },
        "cadastrado_por": {
            "label": "Cadastrado por",
            "resolver": _resolver("cadastrado_por", "username"),
        },
        "created_at": {"label": "Cadastrado em", "resolver": _resolver("created_at")},
    },
}

FILTROS_PERMITIDOS = {
    "vaga": {"status", "setor", "prioridade", "urgente", "atrasada", "motivo", "responsavel", "tags"},
    "candidato": {"etapa", "vaga", "setor_vaga", "saida_negativa", "responsavel", "tags"},
}


def montar_queryset(entidade: str, company_id, filtros: dict, periodo: dict):
    if entidade == "vaga":
        qs = Vaga.objects.filter(company_id=company_id).select_related(
            "setor", "responsavel", "criado_por"
        )
        if filtros.get("status"):
            qs = qs.filter(status__in=filtros["status"])
        if filtros.get("setor"):
            qs = qs.filter(setor_id__in=filtros["setor"])
        if filtros.get("prioridade"):
            qs = qs.filter(prioridade__in=[int(p) for p in filtros["prioridade"]])
        if filtros.get("urgente"):
            qs = qs.filter(urgente=True)
        if filtros.get("atrasada"):
            qs = qs.filter(vagas_services.atrasada_q())
        if filtros.get("motivo"):
            qs = qs.filter(motivo_solicitacao__in=filtros["motivo"])
        if filtros.get("responsavel"):
            qs = qs.filter(responsavel_id__in=filtros["responsavel"])
        if filtros.get("tags"):
            qs = qs.filter(tags__nome__in=filtros["tags"]).distinct()
    else:
        qs = Candidato.objects.filter(company_id=company_id, active=True).select_related(
            "vaga", "vaga__setor", "etapa_atual", "responsavel", "cadastrado_por"
        )
        if filtros.get("etapa"):
            qs = qs.filter(etapa_atual_id__in=filtros["etapa"])
        if filtros.get("vaga"):
            qs = qs.filter(vaga_id=filtros["vaga"])
        if filtros.get("setor_vaga"):
            qs = qs.filter(vaga__setor__nome__in=filtros["setor_vaga"])
        if filtros.get("saida_negativa"):
            qs = qs.filter(etapa_atual__is_saida_negativa=True)
        if filtros.get("responsavel"):
            qs = qs.filter(responsavel_id__in=filtros["responsavel"])
        if filtros.get("tags"):
            qs = qs.filter(tags__nome__in=filtros["tags"]).distinct()

    inicio = periodo.get("inicio")
    fim = periodo.get("fim")
    if inicio:
        qs = qs.filter(created_at__date__gte=inicio)
    if fim:
        qs = qs.filter(created_at__date__lte=fim)

    return qs.order_by("-created_at")


def aplicar_escopo_setor(entidade: str, qs, user):
    """SETOR só vê o que é do próprio setor — mesmo padrão dos outros viewsets."""
    if user.role != "SETOR":
        return qs
    if entidade == "vaga":
        return qs.filter(setor_id=user.setor_id)
    return qs.filter(vaga__setor_id=user.setor_id)


def _serializar_valor(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y %H:%M")
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def gerar_linhas(entidade: str, campos: list[str], queryset):
    resolvers = CAMPOS_PERMITIDOS[entidade]
    for obj in queryset.iterator():
        yield [_serializar_valor(resolvers[campo]["resolver"](obj)) for campo in campos]


def agrupar(entidade: str, agrupamento: str, queryset) -> list[tuple[str, int]]:
    resolver = CAMPOS_PERMITIDOS[entidade][agrupamento]["resolver"]
    contagem: Counter = Counter()
    for obj in queryset.iterator():
        valor = _serializar_valor(resolver(obj))
        contagem[valor or "—"] += 1
    return sorted(contagem.items())
