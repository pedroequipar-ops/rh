from ..interfaces.i_vaga_repository import IVagaRepository
from ..models import Vaga


class VagaRepository(IVagaRepository):
    def get_by_id(self, vaga_id, company_id):
        return Vaga.objects.select_related("setor").get(id=vaga_id, company_id=company_id)

    def list_by_company(self, company_id):
        return Vaga.objects.filter(company_id=company_id).select_related("setor")

    def list_by_setor(self, company_id, setor_id):
        return self.list_by_company(company_id).filter(setor_id=setor_id)

    def create(self, data):
        return Vaga.objects.create(**data)

    def update(self, vaga, data):
        for field, value in data.items():
            setattr(vaga, field, value)
        vaga.save()
        return vaga
