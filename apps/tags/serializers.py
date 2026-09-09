from rest_framework import serializers

from .models import Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "nome", "cor"]
        read_only_fields = ["id"]


class TagsField(serializers.Field):
    """Leitura: [{id,nome,cor}] das tags da instância.
    Escrita: lista de nomes livres (com ou sem '#') — quem resolve pra Tag
    (get_or_create por empresa) é o create()/update() do serializer dono."""

    def to_representation(self, value):
        return TagSerializer(value.all().order_by("nome"), many=True).data

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Esperado uma lista de nomes de tag.")
        return [str(nome) for nome in data]
