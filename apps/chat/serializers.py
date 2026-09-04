from rest_framework import serializers

from .models import ChatMensagem


class ChatMensagemSerializer(serializers.ModelSerializer):
    autor = serializers.CharField(source="autor.username", read_only=True)
    autor_id = serializers.UUIDField(source="autor.id", read_only=True)

    class Meta:
        model = ChatMensagem
        fields = ["id", "candidato_id", "autor", "autor_id", "texto", "created_at"]
        read_only_fields = fields
