from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPagination
from apps.core.permissions import HasFunctionPermission
from apps.vagas import services as vagas_services
from apps.vagas.models import Vaga
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
    BuscaIaRequestSerializer,
    CandidatoMoverEtapaSerializer,
    CandidatoNotificacaoSerializer,
    CandidatoSerializer,
    CurriculoUrlResponseSerializer,
    UploadUrlRequestSerializer,
    UploadUrlResponseSerializer,
)


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
        "restaurar": "candidatos.delete",
        "busca_ia": "candidatos.view",
        "sugerir_tags": "candidatos.view",
        "gerar_email_reprovacao": "candidatos.view",
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
            qs = self.repo.list_by_setor(company_id, user.setor_id)
        else:
            qs = self.repo.list_by_company(company_id)
        responsavel_param = self.request.query_params.get("responsavel")
        if responsavel_param:
            qs = qs.filter(responsavel_id=responsavel_param)
        return qs

    def create(self, request, *args, **kwargs):
        curriculo_key = request.data.get("curriculo_key")
        if curriculo_key and not MinioStorage().head_object(_bucket(), curriculo_key):
            raise ValidationError({"curriculo_key": "Currículo não encontrado no storage."})
        response = super().create(request, *args, **kwargs)
        return response

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        vaga = serializer.validated_data["vaga"]
        if vaga.status in services.VAGA_BLOQUEIA_CANDIDATO:
            raise ValidationError(
                {"vaga_id": "Vaga ainda não está recebendo candidaturas."}
            )
        extra = {"company_id": company_id, "cadastrado_por": self.request.user}
        if "etapa_atual" not in serializer.validated_data:
            extra["etapa_atual"] = services.etapa_inicial(company_id)
        candidato = serializer.save(**extra)
        services.registrar_cadastro(candidato, self.request.user)
        if vaga.status in services.VAGA_ABRE_TRIAGEM:
            vagas_services.aplicar_transicao(
                vaga,
                Vaga.Status.EM_TRIAGEM,
                self.request.user,
                "auto: primeiro candidato cadastrado",
                checar_papel=False,
            )
        QueueEngine().publish(
            "notifications",
            {
                "tipo": "candidato_cadastrado",
                "candidato_id": str(candidato.id),
                "vaga_id": str(candidato.vaga_id),
                "company_id": str(company_id),
            },
        )

    def perform_update(self, serializer):
        responsavel_mudou = "responsavel" in serializer.validated_data
        responsavel_antes = serializer.instance.responsavel if responsavel_mudou else None
        candidato = serializer.save()
        if responsavel_mudou and candidato.responsavel_id != (
            responsavel_antes.id if responsavel_antes else None
        ):
            services.registrar_mudanca_responsavel(
                candidato, responsavel_antes, candidato.responsavel, self.request.user
            )
        # "tags"/"responsavel" já logam sua própria entrada — só registra
        # "editou" genérico se sobrou algum outro campo no PATCH.
        if set(serializer.validated_data) - {"tags", "responsavel"}:
            services.registrar_edicao(candidato, self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.repo.soft_delete(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        """Desfaz uma exclusão recente (toast "Desfazer" da Listagem)."""
        company_id = capture_company_id(request)
        try:
            candidato = Candidato.allobjects.get(id=pk, company_id=company_id)
        except Candidato.DoesNotExist:
            raise NotFound("Candidato não encontrado.")
        candidato.active = True
        candidato.save(update_fields=["active", "updated_at"])
        return Response(CandidatoSerializer(candidato, context=self.get_serializer_context()).data)

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

        motivo = serializer.validated_data.get("motivo", "").strip()
        if etapa.is_saida_negativa and not motivo:
            raise ValidationError({"motivo": "Informe o motivo."})

        candidato = self.repo.mover_etapa(candidato, etapa, motivo)
        services.notificar_mudanca_etapa(candidato, etapa, company_id, motivo)
        services.registrar_mudanca_etapa(candidato, etapa, request.user, motivo=motivo)
        return Response(CandidatoSerializer(candidato).data)

    @action(detail=False, methods=["post"], url_path="busca-ia")
    def busca_ia(self, request):
        serializer = BuscaIaRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company_id = capture_company_id(request)

        try:
            resultados, interpretacao = services.buscar_candidatos_com_ia(
                company_id, serializer.validated_data["frase"], base_queryset=self.get_queryset()
            )
        except services.BuscaIAError:
            raise ValidationError(
                {"detail": "Não foi possível interpretar essa busca agora, tenta de novo."}
            )

        return Response(
            {
                "interpretacao": interpretacao,
                "resultados": CandidatoSerializer(
                    resultados, many=True, context=self.get_serializer_context()
                ).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="sugerir-tags")
    def sugerir_tags(self, request, pk=None):
        candidato = self.get_object()
        company_id = capture_company_id(request)
        try:
            dto = services.sugerir_tags_candidato(company_id, candidato)
        except services.TagSugestaoError:
            raise ValidationError(
                {"detail": "Não foi possível sugerir tags agora, tenta de novo."}
            )
        return Response({"tags": dto.tags, "interpretacao": dto.interpretacao})

    @action(detail=True, methods=["post"], url_path="gerar-email-reprovacao")
    def gerar_email_reprovacao(self, request, pk=None):
        candidato = self.get_object()
        if not candidato.reprovado_em:
            raise ValidationError({"detail": "Candidato não foi reprovado."})
        company_id = capture_company_id(request)
        try:
            dto = services.gerar_email_reprovacao(company_id, candidato)
        except services.EmailReprovacaoError:
            raise ValidationError(
                {"detail": "Não foi possível gerar o rascunho agora, tenta de novo."}
            )
        return Response({"assunto": dto.assunto, "corpo": dto.corpo, "interpretacao": dto.interpretacao})


class CandidatoNotificacaoListView(generics.ListAPIView):
    """``?lida=false`` (default, sem paginação real — usado pelo sininho pro
    total de não lidas) ou ``?lida=true`` (histórico, paginado de verdade)."""

    serializer_class = CandidatoNotificacaoSerializer
    permission_classes = [IsAuthenticated]

    @property
    def pagination_class(self):
        return StandardPagination if self.request.query_params.get("lida") == "true" else None

    def get_queryset(self):
        lida = self.request.query_params.get("lida") == "true"
        qs = CandidatoNotificacao.objects.filter(
            destinatario=self.request.user, lida=lida
        ).select_related("candidato")
        return qs if lida else qs[:20]


class CandidatoNotificacaoMarcarLidasView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        CandidatoNotificacao.objects.filter(destinatario=request.user, lida=False).update(
            lida=True, lida_em=timezone.now()
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidatoNotificacaoMarcarUmaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        lida = request.data.get("lida", True)
        atualizados = CandidatoNotificacao.objects.filter(
            id=pk, destinatario=request.user
        ).update(lida=lida, lida_em=timezone.now() if lida else None)
        if not atualizados:
            raise NotFound("Notificação não encontrada.")
        return Response(status=status.HTTP_204_NO_CONTENT)
