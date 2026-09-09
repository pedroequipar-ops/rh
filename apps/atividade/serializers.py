from rest_framework import serializers

from .models import Comentario


class AtividadeFeedItemSerializer(serializers.Serializer):
    """Item unificado do feed: Atividade, Comentario ou VagaHistoricoStatus legado."""

    tipo = serializers.ChoiceField(choices=["atividade", "comentario", "historico"])
    id = serializers.CharField()
    autor = serializers.CharField()
    descricao = serializers.CharField()
    created_at = serializers.DateTimeField()


class ComentarioCriarSerializer(serializers.Serializer):
    alvo_tipo = serializers.ChoiceField(choices=["vaga", "candidato"])
    alvo_id = serializers.UUIDField()
    texto = serializers.CharField(max_length=2000, trim_whitespace=True)


class ComentarioSerializer(serializers.ModelSerializer):
    autor = serializers.CharField(source="autor.username", read_only=True)

    class Meta:
        model = Comentario
        fields = ["id", "autor", "alvo_tipo", "alvo_id", "texto", "created_at"]
        read_only_fields = fields
