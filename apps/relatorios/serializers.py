from rest_framework import serializers

from .services import CAMPOS_PERMITIDOS, FILTROS_PERMITIDOS


class PeriodoSerializer(serializers.Serializer):
    inicio = serializers.DateField(required=False, allow_null=True)
    fim = serializers.DateField(required=False, allow_null=True)


class RelatorioSerializer(serializers.Serializer):
    entidade = serializers.ChoiceField(choices=list(CAMPOS_PERMITIDOS))
    campos = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    filtros = serializers.DictField(required=False, default=dict)
    periodo = PeriodoSerializer(required=False)
    agrupamento = serializers.CharField(required=False, allow_blank=True, default="")
    modo = serializers.ChoiceField(choices=["detalhado", "agrupado"], default="detalhado")
    formato = serializers.ChoiceField(choices=["csv", "json"], default="csv")

    def validate(self, attrs):
        entidade = attrs["entidade"]
        campos_validos = set(CAMPOS_PERMITIDOS[entidade])

        campos = attrs.get("campos") or list(campos_validos)
        invalidos = set(campos) - campos_validos
        if invalidos:
            raise serializers.ValidationError(
                {"campos": f"Campo(s) inválido(s): {', '.join(sorted(invalidos))}"}
            )
        attrs["campos"] = campos

        filtros = attrs.get("filtros") or {}
        filtros_invalidos = set(filtros) - FILTROS_PERMITIDOS[entidade]
        if filtros_invalidos:
            raise serializers.ValidationError(
                {"filtros": f"Filtro(s) inválido(s): {', '.join(sorted(filtros_invalidos))}"}
            )
        attrs["filtros"] = filtros

        agrupamento = attrs.get("agrupamento") or ""
        if attrs["modo"] == "agrupado":
            if not agrupamento or agrupamento not in campos_validos:
                raise serializers.ValidationError(
                    {"agrupamento": "Obrigatório e precisa ser um campo válido da entidade."}
                )
        attrs["agrupamento"] = agrupamento
        attrs["periodo"] = attrs.get("periodo") or {}

        return attrs
