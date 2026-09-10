from datetime import timedelta

import pytest
from django.utils import timezone

from apps.vagas import services
from apps.vagas.models import Vaga


@pytest.mark.django_db
def test_atrasada_q_tem_paridade_com_prazo_estourado(company_factory, setor_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    hoje = timezone.localdate()
    ontem = hoje - timedelta(days=1)
    amanha = hoje + timedelta(days=1)

    vagas = [
        # status ativo, prazo já passou -> atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=ontem),
        # status ativo, início previsto já passou -> atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.APROVADA, data_inicio_prevista=ontem),
        # status ativo, prazo no futuro -> não atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.PUBLICADA, data_alvo_preenchimento=amanha),
        # status ativo, sem datas -> não atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.EM_TRIAGEM),
        # status fora do fluxo de prazo (RASCUNHO), mesmo com prazo vencido -> não atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.RASCUNHO, data_alvo_preenchimento=ontem),
        # já preenchida -> não atrasada
        vaga_factory(company=company, setor=setor, status=Vaga.Status.PREENCHIDA, data_alvo_preenchimento=ontem),
    ]

    esperado_por_python = {v.id for v in vagas if services._prazo_estourado(v, hoje)}
    encontrado_pelo_q = set(
        Vaga.objects.filter(id__in=[v.id for v in vagas])
        .filter(services.atrasada_q(hoje))
        .values_list("id", flat=True)
    )

    assert encontrado_pelo_q == esperado_por_python
    assert len(esperado_por_python) == 2
