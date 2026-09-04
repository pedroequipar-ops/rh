from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasFunctionPermission
from utils.utils import capture_company_id

from .models import Setor
from .serializers import MeSerializer, SetorSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class SetorViewSet(viewsets.ModelViewSet):
    queryset = Setor.objects.none()
    serializer_class = SetorSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "setores"
    permission_action_map = {
        "list": "setores.view",
        "retrieve": "setores.view",
        "create": "setores.create",
        "update": "setores.edit",
        "partial_update": "setores.edit",
    }
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        return Setor.objects.filter(company_id=company_id).order_by("nome")

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        serializer.save(company_id=company_id)
