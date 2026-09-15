from rest_framework import serializers

from .models import CaixaEntradaEmail, CandidatoTriagemIA

TOP_DESTAQUE = 10


class CandidatoTriagemIASerializer(serializers.ModelSerializer):
    vaga_titulo = serializers.CharField(source="vaga.titulo", read_only=True, default="")
    candidato_resultante_id = serializers.UUIDField(
        source="candidato_resultante.id", read_only=True, default=None
    )
    destaque = serializers.SerializerMethodField()

    def get_destaque(self, obj) -> bool:
        top_ids = self.context.get("top_ids")
        return top_ids is not None and obj.id in top_ids

    class Meta:
        model = CandidatoTriagemIA
        fields = [
            "id",
            "vaga_id",
            "vaga_titulo",
            "email_remetente",
            "nome_remetente",
            "assunto_email",
            "nome_extraido",
            "email_extraido",
            "telefone_extraido",
            "cpf_extraido",
            "linkedin_extraido",
            "perfil_formacao",
            "perfil_experiencia",
            "perfil_habilidades",
            "perfil_certificacoes",
            "curriculo_key",
            "score",
            "justificativa_ia",
            "destaque",
            "status",
            "erro_detalhe",
            "candidato_resultante_id",
            "resolvido_em",
            "created_at",
        ]
        read_only_fields = fields


class TriagemIaDecidirSerializer(serializers.Serializer):
    acao = serializers.ChoiceField(choices=["funil", "banco_talentos", "descartar"])
    motivo = serializers.CharField(required=False, allow_blank=True, default="")


class TriagemIaRotearSerializer(serializers.Serializer):
    vaga_id = serializers.UUIDField()


MAX_ANEXO_WEBHOOK_BYTES = 15 * 1024 * 1024  # 15MB — generoso pra currículo, mas limita o pior caso


class TriagemIaWebhookSerializer(serializers.Serializer):
    arquivo = serializers.FileField()
    email_remetente = serializers.EmailField()
    nome_remetente = serializers.CharField(required=False, allow_blank=True, default="")
    assunto = serializers.CharField(required=False, allow_blank=True, default="")
    message_id = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_arquivo(self, value):
        # Endpoint é autenticado só por token fixo (sem login de usuário) --
        # barra tamanho antes de qualquer `.read()` pra não deixar um
        # caller mal-comportado (ou token vazado) esgotar memória com um
        # POST gigante.
        if value.size > MAX_ANEXO_WEBHOOK_BYTES:
            raise serializers.ValidationError(
                f"Arquivo muito grande (máx. {MAX_ANEXO_WEBHOOK_BYTES // (1024 * 1024)}MB)."
            )
        return value


class CaixaEntradaEmailSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True, required=False, allow_blank=True)
    host = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CaixaEntradaEmail
        fields = [
            "id",
            "provider",
            "host",
            "porta",
            "usar_ssl",
            "usuario",
            "senha",
            "pasta",
            "ativo",
            "ultima_verificacao_em",
            "ultimo_erro",
        ]
        read_only_fields = ["id", "provider", "ultima_verificacao_em", "ultimo_erro"]
