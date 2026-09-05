from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.permissions import HasFunctionPermission
from utils.utils import capture_company_id

from .models import EtapaKanban, Vaga, VagaNotificacao
from .repositories.etapa_repository import EtapaRepository
from .repositories.vaga_repository import VagaRepository
from .serializers import (
    EtapaKanbanReordenarSerializer,
    EtapaKanbanSerializer,
    VagaNotificacaoSerializer,
    VagaSerializer,
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
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = VagaRepository()

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        user = self.request.user
        if user.role == "SETOR":
            return self.repo.list_by_setor(company_id, user.setor_id)
        return self.repo.list_by_company(company_id)

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        user = self.request.user
        extra = {"company_id": company_id, "criado_por": user}

        if user.role == "SETOR":
            extra["setor_id"] = user.setor_id

        vaga = serializer.save(**extra)

        if user.role == "SETOR":
            _notificar_vaga_criada(vaga, company_id)

    def perform_update(self, serializer):
        if self.request.user.role == "SETOR":
            serializer.validated_data.pop("setor", None)
        serializer.save()

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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _notificar_vaga_criada(vaga, company_id):
    destinatarios = User.objects.filter(company_id=company_id, role="RH", is_active=True)
    mensagem = f'Setor "{vaga.setor.nome}" adicionou a vaga "{vaga.titulo}"'
    VagaNotificacao.objects.bulk_create(
        [
            VagaNotificacao(
                company_id=company_id,
                destinatario=user,
                vaga=vaga,
                mensagem=mensagem,
            )
            for user in destinatarios
        ]
    )


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
