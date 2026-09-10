from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import HasFunctionPermission
from utils.utils import capture_company_id

from .models import Tarefa
from .serializers import TarefaSerializer


class TarefaViewSet(viewsets.ModelViewSet):
    queryset = Tarefa.objects.none()
    serializer_class = TarefaSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "tarefas"
    permission_action_map = {
        "list": "tarefas.view",
        "retrieve": "tarefas.view",
        "create": "tarefas.create",
        "update": "tarefas.edit",
        "partial_update": "tarefas.edit",
        "destroy": "tarefas.delete",
        "concluir": "tarefas.edit",
        "reabrir": "tarefas.edit",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        qs = Tarefa.objects.filter(company_id=company_id).select_related(
            "responsavel", "criado_por"
        )
        user = self.request.user
        if user.role == "SETOR":
            qs = qs.filter(Q(responsavel_id=user.id) | Q(criado_por_id=user.id))

        params = self.request.query_params
        responsavel = params.get("responsavel")
        if responsavel:
            qs = qs.filter(responsavel_id=responsavel)
        alvo_tipo = params.get("alvo_tipo")
        if alvo_tipo:
            qs = qs.filter(alvo_tipo=alvo_tipo.upper())
        alvo_id = params.get("alvo_id")
        if alvo_id:
            qs = qs.filter(alvo_id=alvo_id)
        if params.get("pendentes") == "1":
            qs = qs.filter(done_at__isnull=True)
        return qs

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        user = self.request.user
        extra = {"company_id": company_id, "criado_por": user}
        if "responsavel" not in serializer.validated_data:
            extra["responsavel"] = user
        serializer.save(**extra)

    @action(detail=True, methods=["post"], url_path="concluir")
    def concluir(self, request, pk=None):
        tarefa = self.get_object()
        tarefa.done_at = timezone.now()
        tarefa.save(update_fields=["done_at", "updated_at"])
        return Response(TarefaSerializer(tarefa, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="reabrir")
    def reabrir(self, request, pk=None):
        tarefa = self.get_object()
        tarefa.done_at = None
        tarefa.save(update_fields=["done_at", "updated_at"])
        return Response(TarefaSerializer(tarefa, context=self.get_serializer_context()).data)
