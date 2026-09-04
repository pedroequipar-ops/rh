from rest_framework import serializers

from .models import Setor, User


class SetorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ["id", "nome", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MeSerializer(serializers.ModelSerializer):
    setor = SetorSerializer(read_only=True)
    company_id = serializers.UUIDField(source="company.id", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "setor",
            "company_id",
        ]
