from ..interfaces.i_triagem_ia_repository import ITriagemIaRepository
from ..models import CandidatoTriagemIA


class TriagemIaRepository(ITriagemIaRepository):
    def get_by_id(self, triagem_id, company_id):
        return CandidatoTriagemIA.objects.select_related("vaga", "candidato_resultante").get(
            id=triagem_id, company_id=company_id
        )

    def list_by_vaga(self, company_id, vaga_id):
        return CandidatoTriagemIA.objects.filter(
            company_id=company_id, vaga_id=vaga_id
        ).select_related("vaga", "candidato_resultante")

    def list_nao_roteados(self, company_id):
        return CandidatoTriagemIA.objects.filter(
            company_id=company_id, vaga__isnull=True
        ).select_related("candidato_resultante")

    def existe_message_id(self, company_id, message_id) -> bool:
        return CandidatoTriagemIA.objects.filter(
            company_id=company_id, message_id=message_id
        ).exists()

    def create(self, data: dict):
        return CandidatoTriagemIA.objects.create(**data)

    def update(self, triagem, data: dict):
        for field, value in data.items():
            setattr(triagem, field, value)
        triagem.save()
        return triagem
