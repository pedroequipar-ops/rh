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


@pytest.mark.django_db
def test_garantir_vaga_banco_talentos_e_idempotente(company_factory, user_factory):
    from apps.accounts.models import User

    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    primeira = services.garantir_vaga_banco_talentos(company.id, rh)
    segunda = services.garantir_vaga_banco_talentos(company.id, rh)

    assert primeira.id == segunda.id
    assert primeira.is_banco_talentos is True
    assert primeira.status == Vaga.Status.PUBLICADA


@pytest.mark.django_db
def test_banco_talentos_excluido_do_board(company_factory, setor_factory, vaga_factory, user_factory):
    from apps.accounts.models import User
    from apps.vagas.repositories.vaga_repository import VagaRepository

    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    vaga_normal = vaga_factory(company=company, setor=setor)
    vaga_pool = services.garantir_vaga_banco_talentos(company.id, rh)

    ids_no_board = set(VagaRepository().list_by_company(company.id).values_list("id", flat=True))

    assert vaga_normal.id in ids_no_board
    assert vaga_pool.id not in ids_no_board


@pytest.mark.django_db
def test_garantir_codigo_email_gera_uma_vez_so(company_factory, setor_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, titulo="Analista Financeiro")

    codigo1 = services.garantir_codigo_email(vaga)
    codigo2 = services.garantir_codigo_email(vaga)

    assert codigo1 == codigo2
    assert codigo1.startswith("analista-financeiro")
