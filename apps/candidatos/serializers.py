from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from apps.vagas.models import EtapaKanban, Vaga
from apps.vagas.serializers import EtapaAtualSerializer

from .models import Candidato


class CandidatoSerializer(serializers.ModelSerializer):
    vaga_id = serializers.PrimaryKeyRelatedField(
        source="vaga", queryset=Vaga.objects.all(), write_only=True
    )
    vaga_titulo = serializers.CharField(source="vaga.titulo", read_only=True)
    etapa_atual = EtapaAtualSerializer(read_only=True)
    etapa_atual_id = serializers.PrimaryKeyRelatedField(
        source="etapa_atual",
        queryset=EtapaKanban.objects.all(),
        write_only=True,
        required=False,
    )
    cadastrado_por = serializers.CharField(source="cadastrado_por.username", read_only=True)
    linkedin_url = serializers.CharField(required=False, allow_blank=True)

    def validate_linkedin_url(self, value):
        if not value:
            return value
        normalized = value if value.startswith(("http://", "https://")) else f"https://{value}"
        try:
            URLValidator()(normalized)
        except DjangoValidationError:
            raise serializers.ValidationError("URL do LinkedIn inválida.")
        return normalized

    class Meta:
        model = Candidato
        fields = [
            "id",
            "nome",
            "email",
            "telefone",
            "cpf",
            "linkedin_url",
            "resumo_perfil",
            "vaga_id",
            "vaga_titulo",
            "etapa_atual",
            "etapa_atual_id",
            "ordem",
            "curriculo_key",
            "curriculo_content_type",
            "cadastrado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "cadastrado_por", "created_at", "updated_at"]


class CandidatoMoverEtapaSerializer(serializers.Serializer):
    etapa_id = serializers.UUIDField()


class UploadUrlRequestSerializer(serializers.Serializer):
    content_type = serializers.CharField(default="application/pdf")


class UploadUrlResponseSerializer(serializers.Serializer):
    upload_url = serializers.CharField()
    curriculo_key = serializers.CharField()


class AnalisarCurriculoRequestSerializer(serializers.Serializer):
    curriculo_key = serializers.CharField()


class AnalisarCurriculoResponseSerializer(serializers.Serializer):
    nome = serializers.CharField(allow_blank=True)
    email = serializers.CharField(allow_blank=True)
    telefone = serializers.CharField(allow_blank=True)
    cpf = serializers.CharField(allow_blank=True)
    linkedin_url = serializers.CharField(allow_blank=True)
    vaga_sugerida_id = serializers.CharField(allow_null=True)
    justificativa = serializers.CharField(allow_blank=True)
    resumo_perfil = serializers.CharField(allow_blank=True)
    erro = serializers.BooleanField(default=False)


class CurriculoUrlResponseSerializer(serializers.Serializer):
    curriculo_url = serializers.CharField()
