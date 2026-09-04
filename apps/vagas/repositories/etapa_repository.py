from ..interfaces.i_etapa_repository import IEtapaRepository
from ..models import EtapaKanban


class EtapaRepository(IEtapaRepository):
    def get_by_id(self, etapa_id, company_id):
        return EtapaKanban.objects.get(id=etapa_id, company_id=company_id)

    def list_by_company(self, company_id):
        return EtapaKanban.objects.filter(company_id=company_id)

    def create(self, data):
        return EtapaKanban.objects.create(**data)

    def update(self, etapa, data):
        for field, value in data.items():
            setattr(etapa, field, value)
        etapa.save()
        return etapa

    def soft_delete(self, etapa):
        etapa.soft_delete()
        return etapa

    def reordenar(self, company_id, ordem):
        etapas = {
            str(etapa.id): etapa for etapa in EtapaKanban.objects.filter(company_id=company_id)
        }
        atualizadas = []
        for posicao, etapa_id in enumerate(ordem):
            etapa = etapas.get(str(etapa_id))
            if etapa is None:
                continue
            etapa.ordem = posicao
            atualizadas.append(etapa)
        EtapaKanban.objects.bulk_update(atualizadas, ["ordem"])
        return EtapaKanban.objects.filter(company_id=company_id)
