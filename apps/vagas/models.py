from django.conf import settings
from django.db import models

from apps.accounts.models import Company, Setor
from apps.core.models import TimeStampedModel


class EtapaKanban(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="etapas")
    nome = models.CharField(max_length=100)
    ordem = models.PositiveIntegerField(default=0)
    is_saida_negativa = models.BooleanField(default=False)
    cor = models.CharField(max_length=20, blank=True, default="")
    # A partir desta etapa, cada pessoa precisa de cadastro completo (vira Candidato).
    # Antes dela, a própria vaga circula pelas colunas com um contador manual.
    exige_cadastro_completo = models.BooleanField(default=False)

    class Meta:
        ordering = ["ordem"]

    def __str__(self):
        return self.nome


class Vaga(TimeStampedModel):
    class Status(models.TextChoices):
        RASCUNHO = "RASCUNHO", "Rascunho"
        SOLICITADA = "SOLICITADA", "Solicitada"
        RECUSADA = "RECUSADA", "Recusada"
        APROVADA = "APROVADA", "Aprovada"
        PUBLICADA = "PUBLICADA", "Publicada"
        RECEBENDO = "RECEBENDO", "Recebendo candidaturas"
        ENCERRADA = "ENCERRADA", "Candidaturas encerradas"
        EM_TRIAGEM = "EM_TRIAGEM", "Em triagem"
        CONGELADA = "CONGELADA", "Congelada"
        CANCELADA = "CANCELADA", "Cancelada"
        PREENCHIDA = "PREENCHIDA", "Preenchida"

    class Prioridade(models.IntegerChoices):
        BAIXA = 1, "Baixa"
        MEDIA = 2, "Média"
        ALTA = 3, "Alta"

    class MotivoSolicitacao(models.TextChoices):
        AUMENTO_QUADRO = "AUMENTO_QUADRO", "Aumento de quadro"
        SUBSTITUICAO = "SUBSTITUICAO", "Substituição"
        PROJETO = "PROJETO", "Projeto novo"
        OUTRO = "OUTRO", "Outro"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vagas")
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    requisitos = models.TextField(blank=True, default="")
    quantidade_vagas = models.PositiveIntegerField(default=1)
    salario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name="vagas")

    # Enquanto status=EM_TRIAGEM: em qual etapa (pré-cadastro) o card da vaga está,
    # e quantas pessoas o RH diz estar nessa fase.
    etapa_atual = models.ForeignKey(
        EtapaKanban,
        on_delete=models.SET_NULL,
        related_name="vagas_na_etapa",
        null=True,
        blank=True,
    )
    qtd_pessoas_fase = models.PositiveIntegerField(default=0)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="vagas_criadas"
    )

    # Fluxo (pré-triagem)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.RASCUNHO
    )
    status_pre_congelamento = models.CharField(max_length=20, blank=True, default="")
    prioridade = models.IntegerField(
        choices=Prioridade.choices, default=Prioridade.MEDIA
    )
    urgente = models.BooleanField(default=False)
    motivo_solicitacao = models.CharField(
        max_length=20, choices=MotivoSolicitacao.choices, blank=True, default=""
    )
    motivo_recusa = models.TextField(blank=True, default="")

    # Datas informadas
    data_inicio_prevista = models.DateField(null=True, blank=True)
    data_alvo_preenchimento = models.DateField(null=True, blank=True)

    # Carimbos automáticos de transição
    solicitada_em = models.DateTimeField(null=True, blank=True)
    aprovada_em = models.DateTimeField(null=True, blank=True)
    recusada_em = models.DateTimeField(null=True, blank=True)
    publicada_em = models.DateTimeField(null=True, blank=True)
    encerrada_em = models.DateTimeField(null=True, blank=True)
    triagem_iniciada_em = models.DateTimeField(null=True, blank=True)
    fechada_em = models.DateTimeField(null=True, blank=True)
    aprovada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="vagas_aprovadas",
        null=True,
        blank=True,
    )

    # Cobrança
    cobrada_em = models.DateTimeField(null=True, blank=True)
    total_cobrancas = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.titulo


class VagaHistoricoStatus(TimeStampedModel):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="vaga_historicos"
    )
    vaga = models.ForeignKey(
        Vaga, on_delete=models.CASCADE, related_name="historico_status"
    )
    de_status = models.CharField(max_length=20, blank=True, default="")
    para_status = models.CharField(max_length=20)
    por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="vaga_transicoes",
        null=True,
        blank=True,
    )
    observacao = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]


class VagaCobranca(TimeStampedModel):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="vaga_cobrancas"
    )
    vaga = models.ForeignKey(Vaga, on_delete=models.CASCADE, related_name="cobrancas")
    de_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cobrancas_feitas"
    )
    para_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cobrancas_recebidas",
    )
    status_no_momento = models.CharField(max_length=20)
    mensagem = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]


class VagaNotificacao(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vaga_notificacoes")
    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vaga_notificacoes"
    )
    vaga = models.ForeignKey(Vaga, on_delete=models.CASCADE, related_name="notificacoes")
    mensagem = models.CharField(max_length=255)
    lida = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
