from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from unittest.mock import patch

import pytest
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.candidatos.interfaces.i_triagem_ia_extractor import (
    CandidatoPontuadoDTO,
    ITriagemIaExtractor,
)
from apps.candidatos.models import Candidato
from apps.triagem_ia import services
from apps.triagem_ia.models import CandidatoTriagemIA, StatusTriagemIA
from apps.triagem_ia.repositories.triagem_ia_repository import TriagemIaRepository
from apps.vagas.models import Vaga


class FakeTriagemExtractorSucesso(ITriagemIaExtractor):
    def pontuar(self, texto_curriculo, vaga):
        return CandidatoPontuadoDTO(
            nome="João da Silva",
            email="joao@example.com",
            telefone="11988887777",
            score=90,
            justificativa="Perfil muito aderente.",
        )


class FakeTriagemExtractorFalha(ITriagemIaExtractor):
    def pontuar(self, texto_curriculo, vaga):
        raise RuntimeError("IA indisponível")


def _email_com_anexo(*, to="vagas+analista-abcd@example.com", subject="Candidatura", message_id="<1@example.com>"):
    msg = MIMEMultipart()
    msg["From"] = "Maria Souza <maria@example.com>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = message_id
    anexo = MIMEApplication(b"%PDF-1.4 conteudo falso", _subtype="pdf")
    anexo.add_header("Content-Disposition", "attachment", filename="curriculo.pdf")
    msg.attach(anexo)
    return msg


def _email_sem_anexo(message_id="<2@example.com>"):
    msg = MIMEMultipart()
    msg["From"] = "Maria Souza <maria@example.com>"
    msg["To"] = "vagas@example.com"
    msg["Subject"] = "Candidatura sem anexo"
    msg["Message-ID"] = message_id
    msg.attach(MIMEApplication(b"nao e anexo valido", _subtype="octet-stream"))
    return msg


@pytest.mark.django_db
def test_rotear_vaga_por_tag_no_endereco(company_factory, setor_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, codigo_email="analista-abcd")

    msg = _email_com_anexo(to="vagas+analista-abcd@example.com")
    encontrada = services._rotear_vaga(company.id, msg)

    assert encontrada.id == vaga.id


@pytest.mark.django_db
def test_rotear_vaga_por_tag_no_assunto(company_factory, setor_factory, vaga_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor, codigo_email="analista-abcd")

    msg = _email_com_anexo(to="generico@example.com", subject="Candidatura [VAGA:analista-abcd]")
    encontrada = services._rotear_vaga(company.id, msg)

    assert encontrada.id == vaga.id


@pytest.mark.django_db
def test_rotear_vaga_sem_tag_fica_nao_roteado(company_factory):
    company = company_factory()
    msg = _email_com_anexo(to="generico@example.com", subject="Candidatura")
    assert services._rotear_vaga(company.id, msg) is None


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
@patch("apps.triagem_ia.services.candidatos_services.extrair_texto_anexo", return_value="texto do currículo")
@patch(
    "apps.triagem_ia.services.settings.TRIAGEM_IA_EXTRACTOR_CLASS",
    "apps.triagem_ia.tests.test_services.FakeTriagemExtractorSucesso",
)
def test_processar_mensagem_com_vaga_roteada_pontua_na_hora(
    mock_extrair_texto, mock_storage, company_factory, setor_factory, vaga_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga_factory(company=company, setor=setor, codigo_email="analista-abcd")

    msg = _email_com_anexo()
    repo = TriagemIaRepository()
    triagem = services._processar_mensagem(_caixa(company), msg, repo)

    assert triagem.status == StatusTriagemIA.PRONTO
    assert triagem.score == 90
    assert triagem.vaga is not None
    mock_storage.return_value.upload_file.assert_called_once()


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_processar_mensagem_sem_vaga_roteada_fica_pendente(mock_storage, company_factory):
    company = company_factory()
    msg = _email_com_anexo(to="generico@example.com", subject="Candidatura")
    repo = TriagemIaRepository()

    triagem = services._processar_mensagem(_caixa(company), msg, repo)

    assert triagem.status == StatusTriagemIA.PENDENTE
    assert triagem.vaga is None
    assert triagem.score is None


@pytest.mark.django_db
def test_processar_mensagem_sem_anexo_vira_erro(company_factory):
    company = company_factory()
    msg = _email_sem_anexo()
    repo = TriagemIaRepository()

    triagem = services._processar_mensagem(_caixa(company), msg, repo)

    assert triagem.status == StatusTriagemIA.ERRO
    assert "sem currículo" in triagem.erro_detalhe.lower()


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
def test_processar_mensagem_duplicada_por_message_id_e_ignorada(mock_storage, company_factory):
    company = company_factory()
    msg = _email_sem_anexo(message_id="<dup@example.com>")
    repo = TriagemIaRepository()

    primeira = services._processar_mensagem(_caixa(company), msg, repo)
    segunda = services._processar_mensagem(_caixa(company), msg, repo)

    assert primeira is not None
    assert segunda is None
    assert CandidatoTriagemIA.objects.filter(company=company).count() == 1


@pytest.mark.django_db
@patch("apps.triagem_ia.services.MinioStorage")
@patch("apps.triagem_ia.services.candidatos_services.extrair_texto_anexo", return_value="texto do currículo")
@patch(
    "apps.triagem_ia.services.settings.TRIAGEM_IA_EXTRACTOR_CLASS",
    "apps.triagem_ia.tests.test_services.FakeTriagemExtractorFalha",
)
def test_pontuar_triagem_com_erro_na_ia_marca_status_erro(
    mock_extrair_texto, mock_storage, company_factory, setor_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    triagem = triagem_ia_factory(company=company, vaga=vaga, score=None, status=StatusTriagemIA.PENDENTE)

    services._pontuar_triagem(triagem)

    assert triagem.status == StatusTriagemIA.ERRO
    assert triagem.tentativas == 1


@pytest.mark.django_db
def test_decidir_funil_cria_candidato_na_vaga(
    company_factory, setor_factory, user_factory, etapa_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company, exige_cadastro_completo=True)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(company=company, vaga=vaga)

    candidato = services.decidir(triagem, "funil", rh)

    triagem.refresh_from_db()
    assert candidato.vaga_id == vaga.id
    assert triagem.status == StatusTriagemIA.RESOLVIDO
    assert triagem.candidato_resultante_id == candidato.id


@pytest.mark.django_db
def test_decidir_descartar_usa_etapa_saida_negativa_e_motivo_da_ia(
    company_factory, setor_factory, user_factory, etapa_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_saida = etapa_factory(company=company, is_saida_negativa=True)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(
        company=company, vaga=vaga, justificativa_ia="Não tem a experiência exigida."
    )

    candidato = services.decidir(triagem, "descartar", rh)

    assert candidato.etapa_atual_id == etapa_saida.id
    assert candidato.motivo_reprovacao == "Não tem a experiência exigida."
    assert candidato.reprovado_em is not None


@pytest.mark.django_db
def test_decidir_banco_talentos_nao_precisa_de_vaga_roteada(
    company_factory, user_factory, etapa_factory, triagem_ia_factory, vaga_factory, setor_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    etapa_factory(company=company, exige_cadastro_completo=True)
    vaga_factory(company=company, setor=setor)  # garante ao menos 1 vaga na empresa
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(company=company, vaga=None)

    candidato = services.decidir(triagem, "banco_talentos", rh)

    assert candidato.vaga.is_banco_talentos is True
    assert candidato.vaga.company_id == company.id


@pytest.mark.django_db
def test_decidir_funil_sem_vaga_roteada_levanta_erro(
    company_factory, user_factory, triagem_ia_factory
):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(company=company, vaga=None)

    with pytest.raises(ValidationError):
        services.decidir(triagem, "funil", rh)


@pytest.mark.django_db
def test_decidir_item_ja_resolvido_levanta_erro(
    company_factory, setor_factory, user_factory, vaga_factory, triagem_ia_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    vaga = vaga_factory(company=company, setor=setor)
    rh = user_factory(company=company, role=User.Role.RH)
    triagem = triagem_ia_factory(
        company=company, vaga=vaga, status=StatusTriagemIA.RESOLVIDO
    )

    with pytest.raises(ValidationError):
        services.decidir(triagem, "funil", rh)


def _caixa(company):
    from apps.triagem_ia.models import CaixaEntradaEmail

    return CaixaEntradaEmail(
        company_id=company.id,
        host="imap.example.com",
        usuario="vagas@example.com",
        senha_cifrada="",
    )
