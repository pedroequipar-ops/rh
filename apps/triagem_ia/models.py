from django.conf import settings
from django.db import models

from apps.accounts.models import Company
from apps.candidatos.models import Candidato
from apps.core.models import TimeStampedModel
from apps.vagas.models import Vaga


class ProviderCaixaEntrada(models.TextChoices):
    IMAP = "IMAP", "IMAP manual"
    GOOGLE = "GOOGLE", "Google (Gmail)"


class CaixaEntradaEmail(TimeStampedModel):
    """Uma caixa de e-mail monitorada pela Triagem por IA — via IMAP manual
    (``apps/triagem_ia/imap_client.py``) ou Gmail API por OAuth
    (``apps/triagem_ia/gmail_client.py``). Uma empresa pode ter várias, todas
    lidas e roteadas pra vaga certa juntas. Ver ``services.ingerir_todas_caixas``."""

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="caixas_entrada_email"
    )
    provider = models.CharField(
        max_length=10, choices=ProviderCaixaEntrada.choices, default=ProviderCaixaEntrada.IMAP
    )
    # IMAP
    host = models.CharField(max_length=255, blank=True, default="")
    porta = models.PositiveIntegerField(default=993)
    usar_ssl = models.BooleanField(default=True)
    senha_cifrada = models.CharField(max_length=500, blank=True, default="")
    pasta = models.CharField(max_length=100, default="INBOX")
    # Google (OAuth) — access token nunca é persistido, só o refresh token.
    google_refresh_token_cifrado = models.CharField(max_length=1000, blank=True, default="")
    # Comum aos dois provedores
    usuario = models.CharField(max_length=255)
    ativo = models.BooleanField(default=True)
    ultima_verificacao_em = models.DateTimeField(null=True, blank=True)
    ultimo_erro = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.usuario} ({self.company_id})"


class StatusTriagemIA(models.TextChoices):
    PENDENTE = "PENDENTE", "Pendente"
    PROCESSANDO = "PROCESSANDO", "Processando"
    PRONTO = "PRONTO", "Pronto"
    ERRO = "ERRO", "Erro"
    RESOLVIDO = "RESOLVIDO", "Resolvido"


class CandidatoTriagemIA(TimeStampedModel):
    """Currículo recebido por e-mail, pontuado pela IA, aguardando decisão do
    RH (trazer pro funil / banco de talentos / descartar). Fica separado de
    ``Candidato`` até o RH agir — ver justificativa em
    ``apps/candidatos/services.py::criar_candidato``."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="triagens_ia")
    vaga = models.ForeignKey(
        Vaga,
        on_delete=models.CASCADE,
        related_name="triagens_ia",
        null=True,
        blank=True,
    )

    email_remetente = models.EmailField(blank=True, default="")
    nome_remetente = models.CharField(max_length=255, blank=True, default="")
    assunto_email = models.CharField(max_length=500, blank=True, default="")
    message_id = models.CharField(max_length=998)

    curriculo_key = models.CharField(max_length=500, blank=True, default="")
    curriculo_content_type = models.CharField(max_length=150, blank=True, default="")

    nome_extraido = models.CharField(max_length=255, blank=True, default="")
    email_extraido = models.CharField(max_length=255, blank=True, default="")
    telefone_extraido = models.CharField(max_length=30, blank=True, default="")
    cpf_extraido = models.CharField(max_length=20, blank=True, default="")
    linkedin_extraido = models.CharField(max_length=500, blank=True, default="")
    perfil_formacao = models.TextField(blank=True, default="")
    perfil_experiencia = models.TextField(blank=True, default="")
    perfil_habilidades = models.TextField(blank=True, default="")
    perfil_certificacoes = models.TextField(blank=True, default="")

    score = models.PositiveSmallIntegerField(null=True, blank=True)
    justificativa_ia = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=20, choices=StatusTriagemIA.choices, default=StatusTriagemIA.PENDENTE
    )
    erro_detalhe = models.TextField(blank=True, default="")
    tentativas = models.PositiveSmallIntegerField(default=0)

    candidato_resultante = models.ForeignKey(
        Candidato,
        on_delete=models.SET_NULL,
        related_name="origem_triagem_ia",
        null=True,
        blank=True,
    )
    resolvido_em = models.DateTimeField(null=True, blank=True)
    resolvido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="triagens_ia_resolvidas",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-score", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "message_id"], name="unique_triagem_ia_message_id_por_company"
            )
        ]

    def __str__(self):
        return f"{self.nome_extraido or self.email_remetente} ({self.status})"
