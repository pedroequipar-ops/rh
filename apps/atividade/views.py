from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.candidatos.models import Candidato
from apps.candidatos.services import can_access_candidato
from apps.vagas.models import Vaga, VagaHistoricoStatus
from apps.vagas.services import can_access_vaga
from utils.utils import capture_company_id

from . import services
from .models import AlvoTipo, Atividade, Comentario
from .serializers import (
    AtividadeFeedItemSerializer,
    ComentarioCriarSerializer,
    ComentarioSerializer,
)

_ALVO_MODELOS = {"vaga": (Vaga, AlvoTipo.VAGA, can_access_vaga), "candidato": (Candidato, AlvoTipo.CANDIDATO, can_access_candidato)}


def _resolver_alvo(request, alvo_tipo: str, alvo_id, company_id):
    entrada = _ALVO_MODELOS.get(alvo_tipo)
    if entrada is None:
        raise ValidationError({"alvo_tipo": "Tipo inválido. Use 'vaga' ou 'candidato'."})
    modelo, alvo_tipo_choice, checar_acesso = entrada
    try:
        alvo = modelo.objects.get(id=alvo_id, company_id=company_id)
    except modelo.DoesNotExist:
        raise ValidationError({"alvo_id": "Não encontrado."})
    if not checar_acesso(request.user, alvo):
        raise PermissionDenied("Sem acesso a este registro.")
    return alvo, alvo_tipo_choice


class AtividadeFeedView(APIView):
    """GET /v1/atividade/?alvo_tipo=vaga|candidato&alvo_id= — feed unificado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        alvo_tipo = request.query_params.get("alvo_tipo", "").lower()
        alvo_id = request.query_params.get("alvo_id")
        if not alvo_tipo or not alvo_id:
            raise ValidationError({"detail": "alvo_tipo e alvo_id são obrigatórios."})

        alvo, alvo_tipo_choice = _resolver_alvo(request, alvo_tipo, alvo_id, company_id)

        atividades = Atividade.objects.filter(
            company_id=company_id, alvo_tipo=alvo_tipo_choice, alvo_id=alvo.id
        ).select_related("ator")
        comentarios = Comentario.objects.filter(
            company_id=company_id, alvo_tipo=alvo_tipo_choice, alvo_id=alvo.id
        ).select_related("autor")

        itens = [
            {
                "tipo": "atividade",
                "id": str(a.id),
                "autor": a.ator.username if a.ator_id else "sistema",
                "descricao": a.resumo,
                "created_at": a.created_at,
            }
            for a in atividades
        ] + [
            {
                "tipo": "comentario",
                "id": str(c.id),
                "autor": c.autor.username,
                "descricao": c.texto,
                "created_at": c.created_at,
            }
            for c in comentarios
        ]

        if alvo_tipo_choice == AlvoTipo.VAGA:
            historico = VagaHistoricoStatus.objects.filter(
                company_id=company_id, vaga_id=alvo.id
            ).select_related("por")
            itens += [
                {
                    "tipo": "historico",
                    "id": str(h.id),
                    "autor": h.por.username if h.por_id else "sistema",
                    "descricao": (
                        f"{h.de_status} → {h.para_status}" if h.de_status else h.para_status
                    ),
                    "created_at": h.created_at,
                }
                for h in historico
            ]

        itens.sort(key=lambda item: item["created_at"], reverse=True)
        return Response(AtividadeFeedItemSerializer(itens, many=True).data)


class ComentarioCreateView(APIView):
    """POST /v1/atividade/comentarios/ — cria comentário, resolve @menções."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_id = capture_company_id(request)
        ser = ComentarioCriarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        alvo, _ = _resolver_alvo(
            request, ser.validated_data["alvo_tipo"], ser.validated_data["alvo_id"], company_id
        )
        comentario = services.criar_comentario(request.user, alvo, ser.validated_data["texto"])
        return Response(ComentarioSerializer(comentario).data, status=201)
