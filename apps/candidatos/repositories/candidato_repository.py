from ..interfaces.i_candidato_repository import ICandidatoRepository
from ..models import Candidato


class CandidatoRepository(ICandidatoRepository):
    def get_by_id(self, candidato_id, company_id):
        return Candidato.objects.select_related("vaga", "vaga__setor", "etapa_atual").get(
            id=candidato_id, company_id=company_id
        )

    def list_by_company(self, company_id):
        return Candidato.objects.filter(company_id=company_id).select_related(
            "vaga", "vaga__setor", "etapa_atual"
        )

    def list_by_setor(self, company_id, setor_id):
        return self.list_by_company(company_id).filter(vaga__setor_id=setor_id)

    def create(self, data):
        return Candidato.objects.create(**data)

    def update(self, candidato, data):
        for field, value in data.items():
            setattr(candidato, field, value)
        candidato.save()
        return candidato

    def soft_delete(self, candidato):
        candidato.soft_delete()
        return candidato

    def mover_etapa(self, candidato, etapa):
        candidato.etapa_atual = etapa
        candidato.save(update_fields=["etapa_atual", "updated_at"])
        return candidato
