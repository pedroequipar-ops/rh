from uuid import uuid4

from django.conf import settings
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.permissions import HasFunctionPermission
from apps.vagas.models import EtapaKanban
from apps.vagas.repositories.etapa_repository import EtapaRepository
from utils.queue import QueueEngine
from utils.storage import MinioStorage
from utils.utils import capture_company_id

from . import services
from .models import Candidato, CandidatoNotificacao
from .repositories.candidato_repository import CandidatoRepository
from .serializers import (
    AnalisarCurriculoRequestSerializer,
    AnalisarCurriculoResponseSerializer,
    CandidatoMoverEtapaSerializer,
    CandidatoNotificacaoSerializer,
    CandidatoSerializer,
    CurriculoUrlResponseSerializer,
    UploadUrlRequestSerializer,
    UploadUrlResponseSerializer,
)


def _etapa_inicial(company_id):
    etapa = EtapaKanban.objects.filter(company_id=company_id, nome="Triagem").first()
    if etapa is None:
        etapa = (
            EtapaKanban.objects.filter(company_id=company_id, is_saida_negativa=False)
            .order_by("ordem")
            .first()
        )
    return etapa


def _bucket():
    return settings.MINIO_BUCKET_CANDIDATOS_CURRICULOS


class CandidatoViewSet(viewsets.ModelViewSet):
    queryset = Candidato.objects.none()
    serializer_class = CandidatoSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "candidatos"
    permission_action_map = {
        "list": "candidatos.view",
        "retrieve": "candidatos.view",
        "create": "candidatos.create",
        "update": "candidatos.edit",
        "partial_update": "candidatos.edit",
        "destroy": "candidatos.delete",
        "upload_url": "candidatos.upload_url",
        "analisar_curriculo": "candidatos.analisar_curriculo",
        "curriculo_url": "candidatos.curriculo_url",
        "mover_etapa": "candidatos.mover_etapa",
    }
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = CandidatoRepository()

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        if self.action == "list":
            services.excluir_reprovados_vencidos(company_id)
        user = self.request.user
        if user.role == "SETOR":
            return self.repo.list_by_setor(company_id, user.setor_id)
        return self.repo.list_by_company(company_id)

    def create(self, request, *args, **kwargs):
        curriculo_key = request.data.get("curriculo_key")
        if curriculo_key and not MinioStorage().head_object(_bucket(), curriculo_key):
            raise ValidationError({"curriculo_key": "Currículo não encontrado no storage."})
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        extra = {"company_id": company_id, "cadastrado_por": self.request.user}
        if "etapa_atual" not in serializer.validated_data:
            extra["etapa_atual"] = _etapa_inicial(company_id)
        candidato = serializer.save(**extra)
        QueueEngine().publish(
            "notifications",
            {
                "tipo": "candidato_cadastrado",
                "candidato_id": str(candidato.id),
                "vaga_id": str(candidato.vaga_id),
                "company_id": str(company_id),
            },
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.repo.soft_delete(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="upload-url")
    def upload_url(self, request):
        serializer = UploadUrlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content_type = serializer.validated_data["content_type"]

        curriculo_key = f"candidatos/{uuid4()}.pdf"
        upload_url = MinioStorage().presigned_put_url(
            _bucket(), curriculo_key, content_type, expires=900
        )
        response = UploadUrlResponseSerializer(
            {"upload_url": upload_url, "curriculo_key": curriculo_key}
        )
        return Response(response.data)

    @action(detail=False, methods=["post"], url_path="analisar-curriculo")
    def analisar_curriculo(self, request):
        serializer = AnalisarCurriculoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company_id = capture_company_id(request)

        try:
            dto = services.extrair_dados_candidato(
                serializer.validated_data["curriculo_key"], company_id
            )
        except services.CurriculoExtractionError:
            dto_data = {
                "nome": "",
                "email": "",
                "telefone": "",
                "cpf": "",
                "linkedin_url": "",
                "vaga_sugerida_id": None,
                "justificativa": "",
                "perfil_formacao": "",
                "perfil_experiencia": "",
                "perfil_habilidades": "",
                "perfil_certificacoes": "",
                "erro": True,
            }
        else:
            dto_data = {
                "nome": dto.nome,
                "email": dto.email,
                "telefone": dto.telefone,
                "cpf": dto.cpf,
                "linkedin_url": dto.linkedin_url,
                "vaga_sugerida_id": dto.vaga_sugerida_id,
                "justificativa": dto.justificativa,
                "perfil_formacao": dto.perfil_formacao,
                "perfil_experiencia": dto.perfil_experiencia,
                "perfil_habilidades": dto.perfil_habilidades,
                "perfil_certificacoes": dto.perfil_certificacoes,
                "erro": False,
            }
        return Response(AnalisarCurriculoResponseSerializer(dto_data).data)

    @action(detail=True, methods=["get"], url_path="curriculo-url")
    def curriculo_url(self, request, pk=None):
        candidato = self.get_object()
        if not candidato.curriculo_key:
            raise NotFound("Este candidato não tem currículo cadastrado.")
        url = MinioStorage().presigned_url(_bucket(), candidato.curriculo_key, expires=3600)
        return Response(CurriculoUrlResponseSerializer({"curriculo_url": url}).data)

    @action(detail=True, methods=["patch"], url_path="mover-etapa")
    def mover_etapa(self, request, pk=None):
        candidato = self.get_object()
        serializer = CandidatoMoverEtapaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company_id = capture_company_id(request)

        etapa_repo = EtapaRepository()
        try:
            etapa = etapa_repo.get_by_id(serializer.validated_data["etapa_id"], company_id)
        except Exception:
            raise NotFound("Etapa não encontrada.")

        candidato = self.repo.mover_etapa(candidato, etapa)
        _notificar_mudanca_etapa(candidato, etapa, company_id)
        return Response(CandidatoSerializer(candidato).data)


def _notificar_mudanca_etapa(candidato, etapa, company_id):
    setor_id = candidato.vaga.setor_id
    if not setor_id:
        return
    destinatarios = User.objects.filter(
        company_id=company_id, role="SETOR", setor_id=setor_id, is_active=True
    )
    mensagem = f'"{candidato.nome}" mudou para a etapa "{etapa.nome}"'
    CandidatoNotificacao.objects.bulk_create(
        [
            CandidatoNotificacao(
                company_id=company_id,
                destinatario=user,
                candidato=candidato,
                mensagem=mensagem,
            )
            for user in destinatarios
        ]
    )


class CandidatoNotificacaoListView(generics.ListAPIView):
    serializer_class = CandidatoNotificacaoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return CandidatoNotificacao.objects.filter(
            destinatario=self.request.user, lida=False
        ).select_related("candidato")[:20]


class CandidatoNotificacaoMarcarLidasView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        CandidatoNotificacao.objects.filter(destinatario=request.user, lida=False).update(
            lida=True
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
