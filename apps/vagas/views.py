from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasFunctionPermission
from utils.utils import capture_company_id

from . import services
from .models import EtapaKanban, Vaga, VagaNotificacao
from .repositories.etapa_repository import EtapaRepository
from .repositories.vaga_repository import VagaRepository
from .serializers import (
    VagaCandidaturasSerializer,
    EtapaKanbanReordenarSerializer,
    EtapaKanbanSerializer,
    VagaAprovarSerializer,
    VagaCobrarSerializer,
    VagaHistoricoStatusSerializer,
    VagaNotificacaoSerializer,
    VagaRecusarSerializer,
    VagaSerializer,
    VagaTransicaoSerializer,
)


class EtapaKanbanViewSet(viewsets.ModelViewSet):
    queryset = EtapaKanban.objects.none()
    serializer_class = EtapaKanbanSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "etapas"
    permission_action_map = {
        "list": "etapas.view",
        "retrieve": "etapas.view",
        "create": "etapas.create",
        "update": "etapas.edit",
        "partial_update": "etapas.edit",
        "destroy": "etapas.delete",
        "reordenar": "etapas.reorder",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = EtapaRepository()

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        return self.repo.list_by_company(company_id)

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        serializer.save(company_id=company_id)

    def perform_destroy(self, instance):
        self.repo.soft_delete(instance)

    @action(detail=False, methods=["post"], url_path="reordenar")
    def reordenar(self, request):
        serializer = EtapaKanbanReordenarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company_id = capture_company_id(request)
        etapas = self.repo.reordenar(company_id, serializer.validated_data["ordem"])
        return Response(EtapaKanbanSerializer(etapas, many=True).data)


class VagaViewSet(viewsets.ModelViewSet):
    queryset = Vaga.objects.none()
    serializer_class = VagaSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "vagas"
    permission_action_map = {
        "list": "vagas.view",
        "retrieve": "vagas.view",
        "create": "vagas.create",
        "update": "vagas.edit",
        "partial_update": "vagas.edit",
        "destroy": "vagas.delete",
        "candidatos": "vagas.candidatos",
        "candidaturas": "vagas.candidaturas",
        "historico": "vagas.view",
        "transicionar": "vagas.transicionar",
        "mover_etapa": "vagas.transicionar",
        "aprovar": "vagas.aprovar",
        "recusar": "vagas.aprovar",
        "cobrar": "vagas.cobrar",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = VagaRepository()

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        user = self.request.user
        if user.role == "SETOR":
            qs = self.repo.list_by_setor(company_id, user.setor_id)
        else:
            qs = self.repo.list_by_company(company_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = self.repo.by_status(qs, status_param.split(","))
        return qs

    def _status_inicial(self, user):
        # Vaga solicitada pelo setor sempre passa por aprovação do RH.
        if user.role == "SETOR":
            return Vaga.Status.SOLICITADA
        return Vaga.Status.APROVADA

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        user = self.request.user
        extra = {"company_id": company_id, "criado_por": user}
        if user.role == "SETOR":
            extra["setor_id"] = user.setor_id

        inicial = self._status_inicial(user)
        now = timezone.now()
        extra["status"] = inicial
        extra["solicitada_em"] = now
        if inicial == Vaga.Status.APROVADA:
            extra["aprovada_em"] = now
            if user.role == "RH":
                extra["aprovada_por"] = user

        vaga = serializer.save(**extra)
        services.registrar_historico(vaga, "", inicial, user, "criação")

        if inicial == Vaga.Status.SOLICITADA or user.role == "SETOR":
            services.notificar_vaga_criada(vaga, company_id)

    def perform_update(self, serializer):
        if self.request.user.role == "SETOR":
            serializer.validated_data.pop("setor", None)
        vaga = serializer.save()
        services.limpar_alerta_prazo_se_futuro(vaga)

    @action(detail=True, methods=["get"], url_path="candidatos")
    def candidatos(self, request, pk=None):
        from apps.candidatos.serializers import CandidatoSerializer

        vaga = self.get_object()
        qs = vaga.candidatos.all()
        page = self.paginate_queryset(qs)
        serializer = CandidatoSerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="historico")
    def historico(self, request, pk=None):
        vaga = self.get_object()
        qs = vaga.historico_status.select_related("por")
        return Response(VagaHistoricoStatusSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="transicionar")
    def transicionar(self, request, pk=None):
        vaga = self.get_object()
        ser = VagaTransicaoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vaga = services.aplicar_transicao(
            vaga,
            ser.validated_data["para"],
            request.user,
            ser.validated_data.get("observacao", ""),
        )
        return Response(VagaSerializer(vaga, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="aprovar")
    def aprovar(self, request, pk=None):
        vaga = self.get_object()
        ser = VagaAprovarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        extra = {
            f: ser.validated_data[f]
            for f in (
                "prioridade",
                "urgente",
                "data_inicio_prevista",
                "data_alvo_preenchimento",
            )
            if f in ser.validated_data
        }
        vaga = services.aplicar_transicao(
            vaga,
            Vaga.Status.APROVADA,
            request.user,
            ser.validated_data.get("observacao", ""),
            extra_fields=extra,
        )
        return Response(VagaSerializer(vaga, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="recusar")
    def recusar(self, request, pk=None):
        vaga = self.get_object()
        ser = VagaRecusarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vaga = services.aplicar_transicao(
            vaga,
            Vaga.Status.RECUSADA,
            request.user,
            extra_fields={"motivo_recusa": ser.validated_data["motivo"]},
        )
        return Response(VagaSerializer(vaga, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="mover-etapa")
    def mover_etapa(self, request, pk=None):
        vaga = self.get_object()
        etapa_id = request.data.get("etapa_id")
        try:
            etapa = EtapaKanban.objects.get(id=etapa_id, company_id=vaga.company_id)
        except (EtapaKanban.DoesNotExist, ValueError, TypeError):
            raise NotFound("Etapa não encontrada.")
        vaga = services.mover_vaga_etapa(vaga, etapa, request.user)
        return Response(VagaSerializer(vaga, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="candidaturas")
    def candidaturas(self, request, pk=None):
        vaga = self.get_object()
        ser = VagaCandidaturasSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vaga = services.registrar_candidaturas_recebidas(
            vaga, ser.validated_data["quantidade"], request.user
        )
        return Response(VagaSerializer(vaga, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="cobrar")
    def cobrar(self, request, pk=None):
        vaga = self.get_object()
        ser = VagaCobrarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        enviadas = services.cobrar_vaga(
            vaga, request.user, ser.validated_data.get("mensagem", "")
        )
        return Response({"cobrancas_enviadas": enviadas})

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VagaNotificacaoListView(generics.ListAPIView):
    serializer_class = VagaNotificacaoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return VagaNotificacao.objects.filter(
            destinatario=self.request.user, lida=False
        ).select_related("vaga")[:20]


class VagaNotificacaoMarcarLidasView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        VagaNotificacao.objects.filter(destinatario=request.user, lida=False).update(lida=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
