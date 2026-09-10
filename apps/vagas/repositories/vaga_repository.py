from django.db.models import Count, F, Q

from ..interfaces.i_vaga_repository import IVagaRepository
from ..models import Vaga

_ORDEM_FLUXO = (
    F("urgente").desc(),
    F("prioridade").desc(),
    F("data_alvo_preenchimento").asc(nulls_last=True),
    F("created_at").desc(),
)


class VagaRepository(IVagaRepository):
    def get_by_id(self, vaga_id, company_id):
        return Vaga.objects.select_related(
            "setor", "aprovada_por", "etapa_atual", "responsavel"
        ).get(id=vaga_id, company_id=company_id)

    def list_by_company(self, company_id):
        return (
            Vaga.objects.filter(company_id=company_id)
            .select_related("setor", "aprovada_por", "etapa_atual", "responsavel")
            .annotate(_n_cand=Count("candidatos", filter=Q(candidatos__active=True)))
            .order_by(*_ORDEM_FLUXO)
        )

    def list_by_setor(self, company_id, setor_id):
        return self.list_by_company(company_id).filter(setor_id=setor_id)

    def by_status(self, queryset, status_list):
        limpos = [s.strip().upper() for s in status_list if s.strip()]
        return queryset.filter(status__in=limpos) if limpos else queryset

    def create(self, data):
        return Vaga.objects.create(**data)

    def update(self, vaga, data):
        for field, value in data.items():
            setattr(vaga, field, value)
        vaga.save()
        return vaga
