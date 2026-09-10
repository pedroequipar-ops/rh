from datetime import date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.utils import capture_company_id

from . import services
from .services import DashboardFiltros


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_int(value):
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


class DashboardView(APIView):
    """GET /v1/dashboard/?inicio=&fim=&setor=&responsavel=&prioridade= —
    agregados pro cockpit inicial. RH escopa por empresa (setor/responsável/
    prioridade opcionais via query); SETOR sempre escopado pelo próprio
    setor, ignorando o parâmetro."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        user = request.user

        setor_id = request.query_params.get("setor") or None
        if user.role == "SETOR":
            setor_id = str(user.setor_id)

        filtros = DashboardFiltros(
            setor_id=setor_id,
            inicio=_parse_date(request.query_params.get("inicio")),
            fim=_parse_date(request.query_params.get("fim")),
            responsavel_id=request.query_params.get("responsavel") or None,
            prioridade=_parse_int(request.query_params.get("prioridade")),
        )

        return Response(
            {
                "resumo": services.resumo_vagas(company_id, filtros),
                "vagas_por_status": services.vagas_por_status(company_id, filtros),
                "vagas_ativas_por_setor": services.vagas_ativas_por_setor(company_id, filtros),
                "vagas_atrasadas": services.vagas_atrasadas(company_id, filtros),
                "funil_etapas": services.funil_etapas(company_id, filtros),
                "candidaturas_vs_cadastrados": services.candidaturas_vs_cadastrados(company_id, filtros),
                "vagas_series": services.vagas_series(company_id, filtros),
                "tempo_medio_por_status": services.tempo_medio_por_status(company_id, filtros),
                "tempo_medio_preenchimento": services.tempo_medio_preenchimento(company_id, filtros),
                "cobrancas": services.cobrancas(company_id, filtros),
                "chats_sem_resposta": services.chats_sem_resposta(company_id, user.role, filtros),
            }
        )
