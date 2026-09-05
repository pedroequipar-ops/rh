from rest_framework import serializers

from .models import Setor, User


class SetorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ["id", "nome", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    setor_id = serializers.PrimaryKeyRelatedField(source="setor", queryset=Setor.objects.all())

    class Meta:
        model = User
        fields = ["id", "username", "password", "email", "first_name", "last_name", "setor_id"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=User.Role.SETOR, **validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    setor_id = serializers.PrimaryKeyRelatedField(
        source="setor", queryset=Setor.objects.all(), required=False
    )

    class Meta:
        model = User
        fields = ["id", "username", "password", "setor_id"]
        read_only_fields = ["id"]

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserListSerializer(serializers.ModelSerializer):
    setor = SetorSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "role", "setor"]


class AlterarSenhaSerializer(serializers.Serializer):
    senha_atual = serializers.CharField(write_only=True)
    senha_nova = serializers.CharField(write_only=True, min_length=8)

    def validate_senha_atual(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["senha_nova"])
        user.save(update_fields=["password"])
        return user


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
