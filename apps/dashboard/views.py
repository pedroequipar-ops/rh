from datetime import date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.utils import capture_company_id

from . import services


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


class DashboardView(APIView):
    """GET /v1/dashboard/?inicio=&fim=&setor= — agregados pro cockpit inicial.
    RH escopa por empresa (setor opcional via query); SETOR sempre escopado
    pelo próprio setor, ignorando o parâmetro."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        user = request.user

        setor_id = request.query_params.get("setor") or None
        if user.role == "SETOR":
            setor_id = str(user.setor_id)

        inicio = _parse_date(request.query_params.get("inicio"))
        fim = _parse_date(request.query_params.get("fim"))

        return Response(
            {
                "resumo": services.resumo_vagas(company_id, setor_id, inicio, fim),
                "vagas_por_status": services.vagas_por_status(company_id, setor_id, inicio, fim),
                "vagas_atrasadas": services.vagas_atrasadas(company_id, setor_id),
                "funil_etapas": services.funil_etapas(company_id, setor_id),
                "candidaturas_vs_cadastrados": services.candidaturas_vs_cadastrados(company_id, setor_id),
                "tempo_medio_por_status": services.tempo_medio_por_status(company_id, setor_id),
                "tempo_medio_preenchimento": services.tempo_medio_preenchimento(company_id, setor_id),
                "cobrancas": services.cobrancas(company_id, setor_id),
                "chats_sem_resposta": services.chats_sem_resposta(company_id, user.role, setor_id),
            }
        )
