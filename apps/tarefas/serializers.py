from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UsuarioResumoSerializer
from apps.atividade.models import AlvoTipo
from utils.utils import capture_company_id

from .models import Tarefa


class TarefaSerializer(serializers.ModelSerializer):
    responsavel = UsuarioResumoSerializer(read_only=True)
    responsavel_id = serializers.PrimaryKeyRelatedField(
        source="responsavel",
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    criado_por = serializers.CharField(source="criado_por.username", read_only=True)
    alvo_tipo = serializers.ChoiceField(choices=AlvoTipo.choices, required=False, allow_blank=True)
    concluida = serializers.SerializerMethodField()

    class Meta:
        model = Tarefa
        fields = [
            "id",
            "titulo",
            "descricao",
            "due_at",
            "done_at",
            "concluida",
            "responsavel",
            "responsavel_id",
            "alvo_tipo",
            "alvo_id",
            "criado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "done_at", "criado_por", "created_at", "updated_at"]

    def get_concluida(self, obj):
        return obj.done_at is not None

    def validate_responsavel_id(self, value):
        if value is None:
            return value
        request = self.context.get("request")
        if request and str(value.company_id) != capture_company_id(request):
            raise serializers.ValidationError("Usuário de outra empresa.")
        return value
