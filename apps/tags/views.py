from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.utils import capture_company_id

from .models import Tag
from .serializers import TagSerializer

LIMITE = 20


class TagListView(APIView):
    """GET /v1/tags/?q= — autocomplete de tags da empresa + contagem de uso."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = capture_company_id(request)
        termo = request.query_params.get("q", "").strip().lstrip("#").lower()

        qs = Tag.objects.filter(company_id=company_id)
        if termo:
            qs = qs.filter(nome__icontains=termo)
        qs = qs.annotate(
            uso_vagas=Count("vagas", distinct=True),
            uso_candidatos=Count("candidatos", distinct=True),
        ).order_by("nome")[:LIMITE]

        data = [
            {**TagSerializer(tag).data, "uso": tag.uso_vagas + tag.uso_candidatos} for tag in qs
        ]
        return Response(data)
