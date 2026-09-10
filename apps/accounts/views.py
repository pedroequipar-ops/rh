from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasFunctionPermission
from utils.utils import capture_company_id

from .models import Setor, User
from .serializers import (
    AlterarSenhaSerializer,
    CompanySerializer,
    MeSerializer,
    SetorSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


class EmpresaView(APIView):
    """GET/PATCH /v1/empresa/ — dados da empresa do usuário logado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CompanySerializer(request.user.company).data)

    def patch(self, request):
        if request.user.role != User.Role.RH and not request.user.is_superuser:
            raise PermissionDenied("Apenas RH pode editar os dados da empresa.")
        serializer = CompanySerializer(request.user.company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class AlterarSenhaView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AlterarSenhaSerializer

    def post(self, request):
        serializer = AlterarSenhaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        "destroy": "setores.delete",
        "restaurar": "setores.delete",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        return Setor.objects.filter(company_id=company_id).order_by("nome")

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        serializer.save(company_id=company_id)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        """Desfaz uma exclusão recente (toast "Desfazer" da Listagem/Configurações)."""
        company_id = capture_company_id(request)
        try:
            setor = Setor.allobjects.get(id=pk, company_id=company_id)
        except Setor.DoesNotExist:
            raise NotFound("Setor não encontrado.")
        setor.active = True
        setor.save(update_fields=["active", "updated_at"])
        return Response(SetorSerializer(setor).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.none()
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "usuarios"
    permission_action_map = {
        "list": "usuarios.view",
        "create": "usuarios.create",
        "update": "usuarios.edit",
        "partial_update": "usuarios.edit",
        "destroy": "usuarios.delete",
        "restaurar": "usuarios.delete",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserCreateSerializer

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        return User.objects.filter(company_id=company_id, is_active=True).order_by("username")

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        setor = serializer.validated_data.get("setor")
        if str(setor.company_id) != str(company_id):
            raise ValidationError({"setor_id": "Setor inválido."})
        serializer.save(company_id=company_id)

    def perform_update(self, serializer):
        setor = serializer.validated_data.get("setor")
        if setor is not None:
            company_id = capture_company_id(self.request)
            if str(setor.company_id) != str(company_id):
                raise ValidationError({"setor_id": "Setor inválido."})
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            raise ValidationError("Você não pode excluir seu próprio usuário.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        """Desfaz uma exclusão recente (toast "Desfazer" da Listagem/Configurações)."""
        company_id = capture_company_id(request)
        try:
            usuario = User.objects.get(id=pk, company_id=company_id)
        except User.DoesNotExist:
            raise NotFound("Usuário não encontrado.")
        usuario.is_active = True
        usuario.save(update_fields=["is_active"])
        return Response(UserListSerializer(usuario).data)
