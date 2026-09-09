from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Company, Setor
from apps.accounts.serializers import SetorSerializer

from . import services
from .models import EtapaKanban, Vaga, VagaHistoricoStatus, VagaNotificacao

_STATUS_SEM_ATRASO = {Vaga.Status.EM_TRIAGEM, Vaga.Status.PREENCHIDA, Vaga.Status.CANCELADA}


class EtapaKanbanSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapaKanban
        fields = [
            "id",
            "nome",
            "ordem",
            "is_saida_negativa",
            "cor",
            "exige_cadastro_completo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EtapaKanbanReordenarSerializer(serializers.Serializer):
    ordem = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class EtapaAtualSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapaKanban
        fields = ["id", "nome", "ordem", "is_saida_negativa", "cor", "exige_cadastro_completo"]


class VagaSerializer(serializers.ModelSerializer):
    setor = SetorSerializer(read_only=True)
    setor_id = serializers.PrimaryKeyRelatedField(
        source="setor", queryset=Setor.objects.all(), write_only=True, required=False
    )
    criado_por = serializers.CharField(source="criado_por.username", read_only=True)
    aprovada_por = serializers.SerializerMethodField()
    etapa_atual = EtapaAtualSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    prioridade_display = serializers.CharField(source="get_prioridade_display", read_only=True)
    atrasada = serializers.SerializerMethodField()
    total_candidatos = serializers.SerializerMethodField()
    total_por_etapa = serializers.SerializerMethodField()
    transicoes_disponiveis = serializers.SerializerMethodField()

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
            "status",
            "status_display",
            "status_pre_congelamento",
            "etapa_atual",
            "qtd_pessoas_fase",
            "prioridade",
            "prioridade_display",
            "urgente",
            "motivo_solicitacao",
            "motivo_recusa",
            "data_inicio_prevista",
            "data_alvo_preenchimento",
            "solicitada_em",
            "aprovada_em",
            "recusada_em",
            "publicada_em",
            "encerrada_em",
            "triagem_iniciada_em",
            "fechada_em",
            "aprovada_por",
            "cobrada_em",
            "total_cobrancas",
            "atrasada",
            "total_candidatos",
            "total_por_etapa",
            "transicoes_disponiveis",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "criado_por",
            "status",
            "status_pre_congelamento",
            "motivo_recusa",
            "solicitada_em",
            "aprovada_em",
            "recusada_em",
            "publicada_em",
            "encerrada_em",
            "triagem_iniciada_em",
            "fechada_em",
            "aprovada_por",
            "cobrada_em",
            "total_cobrancas",
            "created_at",
            "updated_at",
        ]

    def get_aprovada_por(self, obj):
        return obj.aprovada_por.username if obj.aprovada_por_id else None

    def get_atrasada(self, obj):
        if not obj.data_alvo_preenchimento or obj.status in _STATUS_SEM_ATRASO:
            return False
        return obj.data_alvo_preenchimento < timezone.localdate()

    def get_total_candidatos(self, obj):
        anotado = getattr(obj, "_n_cand", None)
        return anotado if anotado is not None else obj.candidatos.count()

    def get_total_por_etapa(self, obj):
        view = self.context.get("view")
        if view is not None and getattr(view, "action", None) == "list":
            return None
        rows = (
            obj.candidatos.values(
                "etapa_atual_id", "etapa_atual__nome", "etapa_atual__ordem"
            )
            .annotate(total=Count("id"))
            .order_by("etapa_atual__ordem")
        )
        return [
            {
                "etapa_id": str(r["etapa_atual_id"]),
                "nome": r["etapa_atual__nome"],
                "ordem": r["etapa_atual__ordem"],
                "total": r["total"],
            }
            for r in rows
        ]

    def get_transicoes_disponiveis(self, obj):
        request = self.context.get("request")
        if request is None:
            return []
        return services.transicoes_disponiveis(obj, request.user)


class VagaTransicaoSerializer(serializers.Serializer):
    para = serializers.ChoiceField(choices=Vaga.Status.choices)
    observacao = serializers.CharField(required=False, allow_blank=True, default="")


class VagaAprovarSerializer(serializers.Serializer):
    prioridade = serializers.ChoiceField(choices=Vaga.Prioridade.choices, required=False)
    urgente = serializers.BooleanField(required=False)
    data_inicio_prevista = serializers.DateField(required=False, allow_null=True)
    data_alvo_preenchimento = serializers.DateField(required=False, allow_null=True)
    observacao = serializers.CharField(required=False, allow_blank=True, default="")


class VagaRecusarSerializer(serializers.Serializer):
    motivo = serializers.CharField()


class VagaCobrarSerializer(serializers.Serializer):
    mensagem = serializers.CharField(required=False, allow_blank=True, default="")


class VagaHistoricoStatusSerializer(serializers.ModelSerializer):
    por = serializers.CharField(source="por.username", read_only=True)

    class Meta:
        model = VagaHistoricoStatus
        fields = ["id", "de_status", "para_status", "por", "observacao", "created_at"]
        read_only_fields = fields


class CompanyConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["exige_aprovacao_vaga"]


class VagaNotificacaoSerializer(serializers.ModelSerializer):
    vaga_id = serializers.UUIDField(source="vaga.id", read_only=True)
    vaga_titulo = serializers.CharField(source="vaga.titulo", read_only=True)

    class Meta:
        model = VagaNotificacao
        fields = ["id", "vaga_id", "vaga_titulo", "mensagem", "created_at"]
        read_only_fields = fields
