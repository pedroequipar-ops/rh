import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import CompanyFactory
from apps.triagem_ia.models import CaixaEntradaEmail, CandidatoTriagemIA
from apps.vagas.tests.factories import VagaFactory


class CaixaEntradaEmailFactory(DjangoModelFactory):
    class Meta:
        model = CaixaEntradaEmail

    company = factory.SubFactory(CompanyFactory)
    host = "imap.example.com"
    porta = 993
    usar_ssl = True
    usuario = "vagas@example.com"
    senha_cifrada = ""
    pasta = "INBOX"
    ativo = True


class CandidatoTriagemIAFactory(DjangoModelFactory):
    class Meta:
        model = CandidatoTriagemIA

    company = factory.SelfAttribute("vaga.company")
    vaga = factory.SubFactory(VagaFactory)
    email_remetente = factory.Sequence(lambda n: f"candidato{n}@example.com")
    nome_remetente = factory.Sequence(lambda n: f"Candidato {n}")
    assunto_email = "Candidatura"
    message_id = factory.Sequence(lambda n: f"<msg-{n}@example.com>")
    curriculo_key = factory.Sequence(lambda n: f"triagem-ia/curriculo-{n}.pdf")
    curriculo_content_type = "application/pdf"
    score = 80
    justificativa_ia = "Perfil compatível."
