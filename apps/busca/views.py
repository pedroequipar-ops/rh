from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Setor
from apps.candidatos.models import Candidato
from apps.vagas.models import Vaga
from utils.utils import capture_company_id

LIMITE = 8


class BuscaView(APIView):
    """Busca global (Ctrl+K): vagas, candidatos e setores por nome/título, escopados por empresa."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        termo = request.query_params.get("q", "").strip()
        vazio = {"vagas": [], "candidatos": [], "setores": []}
        if not termo:
            return Response(vazio)

        # Busca por tag (#nome): fica efetiva na Fase 4, quando o model Tag existir.
        if termo.startswith("#"):
            return Response(vazio)

        company_id = capture_company_id(request)
        user = request.user
        setor_id = user.setor_id if user.role == "SETOR" else None

        vagas_qs = Vaga.objects.filter(company_id=company_id, titulo__icontains=termo)
        candidatos_qs = Candidato.objects.filter(company_id=company_id, nome__icontains=termo)
        setores_qs = Setor.objects.filter(company_id=company_id, nome__icontains=termo)
        if setor_id:
            vagas_qs = vagas_qs.filter(setor_id=setor_id)
            candidatos_qs = candidatos_qs.filter(vaga__setor_id=setor_id)
            setores_qs = setores_qs.filter(id=setor_id)

        vagas = vagas_qs.order_by("-created_at")[:LIMITE]
        candidatos = candidatos_qs.order_by("-created_at")[:LIMITE]
        setores = setores_qs.order_by("nome")[:LIMITE]

        return Response(
            {
                "vagas": [{"id": str(v.id), "titulo": v.titulo, "status": v.status} for v in vagas],
                "candidatos": [{"id": str(c.id), "nome": c.nome} for c in candidatos],
                "setores": [{"id": str(s.id), "nome": s.nome} for s in setores],
            }
        )
