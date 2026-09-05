from rest_framework import serializers

from apps.accounts.models import Setor
from apps.accounts.serializers import SetorSerializer

from .models import EtapaKanban, Vaga, VagaNotificacao


class EtapaKanbanSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapaKanban
        fields = ["id", "nome", "ordem", "is_saida_negativa", "cor", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class EtapaKanbanReordenarSerializer(serializers.Serializer):
    ordem = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class EtapaAtualSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapaKanban
        fields = ["id", "nome", "ordem", "is_saida_negativa", "cor"]


class VagaSerializer(serializers.ModelSerializer):
    setor = SetorSerializer(read_only=True)
    setor_id = serializers.PrimaryKeyRelatedField(
        source="setor", queryset=Setor.objects.all(), write_only=True, required=False
    )
    criado_por = serializers.CharField(source="criado_por.username", read_only=True)

    class Meta:
        model = Vaga
        fields = [
            "id",
            "titulo",
            "descricao",
            "requisitos",
            "quantidade_vagas",
            "salario",
            "setor",
            "setor_id",
            "criado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "criado_por", "created_at", "updated_at"]


class VagaNotificacaoSerializer(serializers.ModelSerializer):
    vaga_id = serializers.UUIDField(source="vaga.id", read_only=True)
    vaga_titulo = serializers.CharField(source="vaga.titulo", read_only=True)

    class Meta:
        model = VagaNotificacao
        fields = ["id", "vaga_id", "vaga_titulo", "mensagem", "created_at"]
        read_only_fields = fields
