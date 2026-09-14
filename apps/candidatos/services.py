import io
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from django.utils.module_loading import import_string
from docx import Document as DocxDocument
from pypdf import PdfReader

from apps.accounts.models import User
from apps.atividade import services as atividade_services
from apps.core.logger import LoggerEngine
from apps.core.notificacoes_ws import publicar_notificacao
from apps.tags.models import Tag
from apps.vagas.models import EtapaKanban, Vaga
from apps.vagas.repositories.vaga_repository import VagaRepository
from utils.queue import QueueEngine
from utils.storage import MinioStorage

from .interfaces.i_curriculo_extractor import CandidatoExtraidoDTO
from .repositories.candidato_repository import CandidatoRepository

log = LoggerEngine(__name__)

DIAS_PARA_EXCLUIR_REPROVADO = 30

# Status de vaga em que criar um Candidato ainda não é permitido / que
# disparam a auto-transição pra EM_TRIAGEM no primeiro candidato. Compartilhado
# entre o fluxo manual (views.py) e a Triagem por IA (apps/triagem_ia).
VAGA_BLOQUEIA_CANDIDATO = {
    Vaga.Status.RASCUNHO,
    Vaga.Status.SOLICITADA,
    Vaga.Status.RECUSADA,
    Vaga.Status.APROVADA,
    Vaga.Status.CANCELADA,
}
VAGA_ABRE_TRIAGEM = {
    Vaga.Status.PUBLICADA,
    Vaga.Status.ENCERRADA,
}


def can_access_candidato(user, candidato) -> bool:
    if user.is_superuser or user.role == "RH":
        return True
    if user.role == "SETOR":
        return str(candidato.vaga.setor_id) == str(user.setor_id)
    return False


def registrar_cadastro(candidato, user):
    atividade_services.registrar(user, "cadastrou", candidato, resumo=f"cadastrou {candidato.nome}")


def registrar_edicao(candidato, user):
    atividade_services.registrar(user, "editou", candidato, resumo="editou os dados do candidato")


def registrar_mudanca_responsavel(candidato, antes, depois, user):
    if depois is None:
        resumo = "removeu o responsável"
    elif antes is None:
        resumo = f"definiu {depois.username} como responsável"
    else:
        resumo = f"trocou o responsável para {depois.username}"
    atividade_services.registrar(user, "mudou_responsavel", candidato, resumo=resumo)


def registrar_mudanca_etapa(candidato, etapa, user, motivo=""):
    resumo = f'moveu para a etapa "{etapa.nome}"'
    if motivo:
        resumo += f": {motivo}"
    atividade_services.registrar(user, "moveu_etapa", candidato, resumo=resumo)


def excluir_reprovados_vencidos(company_id) -> int:
    from .models import Candidato

    limite = timezone.now() - timedelta(days=DIAS_PARA_EXCLUIR_REPROVADO)
    vencidos = Candidato.objects.filter(
        company_id=company_id,
        etapa_atual__is_saida_negativa=True,
        reprovado_em__lte=limite,
    )
    return vencidos.update(active=False, updated_at=timezone.now())


def _extrair_texto_pdf(conteudo: bytes) -> str:
    reader = PdfReader(io.BytesIO(conteudo))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extrair_texto_docx(conteudo: bytes) -> str:
    documento = DocxDocument(io.BytesIO(conteudo))
    return "\n".join(paragrafo.text for paragrafo in documento.paragraphs)


CONTENT_TYPES_DOCX = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


class AnexoNaoSuportadoError(Exception):
    pass


def extrair_texto_anexo(conteudo: bytes, content_type: str) -> str:
    """Extrai o texto de um currículo em PDF ou .docx. Usado tanto pelo
    upload manual (sempre PDF) quanto pela Triagem por IA (apps/triagem_ia),
    que também recebe .docx por e-mail."""
    if content_type in CONTENT_TYPES_DOCX:
        return _extrair_texto_docx(conteudo)
    if content_type == "application/pdf":
        return _extrair_texto_pdf(conteudo)
    raise AnexoNaoSuportadoError(f"Tipo de anexo não suportado: {content_type}")


class CurriculoExtractionError(Exception):
    pass


def etapa_inicial(company_id):
    """Etapa onde uma pessoa recém-cadastrada entra: a primeira que exige
    cadastro completo (ex.: Perfil Comportamental). Antes dela quem circula
    é o card da vaga, não o candidato."""
    base = EtapaKanban.objects.filter(company_id=company_id, is_saida_negativa=False)
    etapa = base.filter(exige_cadastro_completo=True).order_by("ordem").first()
    if etapa is None:
        etapa = base.filter(nome="Triagem").first()
    if etapa is None:
        etapa = base.order_by("ordem").first()
    return etapa


def notificar_mudanca_etapa(candidato, etapa, company_id, motivo=""):
    from .models import CandidatoNotificacao

    setor_id = candidato.vaga.setor_id
    if not setor_id:
        return
    destinatarios = list(
        User.objects.filter(company_id=company_id, role="SETOR", setor_id=setor_id, is_active=True)
    )
    if etapa.is_saida_negativa:
        mensagem = f'"{candidato.nome}" foi descartado. Motivo: {motivo}'
    else:
        mensagem = f'"{candidato.nome}" mudou para a etapa "{etapa.nome}"'
    CandidatoNotificacao.objects.bulk_create(
        [
            CandidatoNotificacao(
                company_id=company_id,
                destinatario=user,
                candidato=candidato,
                mensagem=mensagem,
            )
            for user in destinatarios
        ]
    )
    for user in destinatarios:
        publicar_notificacao(
            user.id,
            "candidato",
            {"mensagem": mensagem, "candidato_id": str(candidato.id)},
        )


def criar_candidato(
    *,
    company_id,
    vaga,
    dados: dict,
    cadastrado_por,
    etapa_atual=None,
    motivo_reprovacao="",
    reprovado_em=None,
):
    """Cria um Candidato "de verdade" fora do fluxo manual de cadastro —
    usado pela Triagem por IA (apps/triagem_ia) quando o RH decide trazer um
    currículo pro funil, pro banco de talentos ou descartar. Espelha os
    mesmos efeitos colaterais de ``CandidatoViewSet.perform_create``."""
    from .models import Candidato

    etapa = etapa_atual or etapa_inicial(company_id)
    candidato = Candidato.objects.create(
        company_id=company_id,
        vaga=vaga,
        etapa_atual=etapa,
        cadastrado_por=cadastrado_por,
        motivo_reprovacao=motivo_reprovacao,
        reprovado_em=reprovado_em,
        **dados,
    )
    registrar_cadastro(candidato, cadastrado_por)
    if etapa is not None and etapa.is_saida_negativa:
        notificar_mudanca_etapa(candidato, etapa, company_id, motivo_reprovacao)
    if vaga.status in VAGA_ABRE_TRIAGEM and not vaga.is_banco_talentos:
        from apps.vagas import services as vagas_services

        vagas_services.aplicar_transicao(
            vaga,
            Vaga.Status.EM_TRIAGEM,
            cadastrado_por,
            "auto: primeiro candidato cadastrado",
            checar_papel=False,
        )
    QueueEngine().publish(
        "notifications",
        {
            "tipo": "candidato_cadastrado",
            "candidato_id": str(candidato.id),
            "vaga_id": str(candidato.vaga_id),
            "company_id": str(company_id),
        },
    )
    return candidato


def extrair_dados_candidato(curriculo_key: str, company_id: str) -> CandidatoExtraidoDTO:
    try:
        conteudo = MinioStorage().get_object(
            settings.MINIO_BUCKET_CANDIDATOS_CURRICULOS, curriculo_key
        )
        texto = _extrair_texto_pdf(conteudo)

        vagas_abertas = VagaRepository().list_by_company(company_id)
        vagas_payload = [
            {
                "id": vaga.id,
                "titulo": vaga.titulo,
                "descricao": vaga.descricao,
                "requisitos": vaga.requisitos,
                "setor": vaga.setor.nome,
            }
            for vaga in vagas_abertas
        ]

        extractor_class = import_string(settings.CURRICULO_EXTRACTOR_CLASS)
        extractor = extractor_class()
        return extractor.extrair(texto, vagas_payload)
    except Exception as exc:
        log.error(
            "falha ao analisar currículo com IA",
            curriculo_key=curriculo_key,
            erro=str(exc),
        )
        raise CurriculoExtractionError(str(exc)) from exc


class BuscaIAError(Exception):
    pass


def buscar_candidatos_com_ia(company_id: str, frase: str, base_queryset=None):
    """Traduz ``frase`` (linguagem natural) num filtro estruturado via IA e
    aplica sobre ``base_queryset`` (já escopado por quem pediu — ver
    ``CandidatoViewSet.get_queryset``; usa todos os candidatos da empresa se
    omitido). Retorna ``(queryset, interpretacao)`` — ``interpretacao`` é a
    frase curta que a IA devolve explicando o que entendeu, pra mostrar pro
    RH."""
    try:
        etapas = list(
            EtapaKanban.objects.filter(company_id=company_id).values(
                "id", "nome", "ordem", "is_saida_negativa"
            )
        )
        tags = list(Tag.objects.filter(company_id=company_id).values_list("nome", flat=True))

        extractor_class = import_string(settings.CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS)
        extractor = extractor_class()
        filtro = extractor.interpretar(frase, etapas, tags)
    except Exception as exc:
        log.error("falha ao interpretar busca de candidatos com IA", frase=frase, erro=str(exc))
        raise BuscaIAError(str(exc)) from exc

    qs = base_queryset if base_queryset is not None else CandidatoRepository().list_by_company(company_id)
    if filtro.etapa_ids:
        qs = qs.filter(etapa_atual_id__in=filtro.etapa_ids)
    elif filtro.etapa_ordem_min is not None:
        qs = qs.filter(etapa_atual__ordem__gte=filtro.etapa_ordem_min)
    if filtro.vaga_titulo_contains:
        qs = qs.filter(vaga__titulo__icontains=filtro.vaga_titulo_contains)
    if filtro.tags:
        qs = qs.filter(tags__nome__in=filtro.tags)
    for palavra in filtro.palavras_chave:
        qs = qs.filter(
            Q(nome__icontains=palavra)
            | Q(perfil_formacao__icontains=palavra)
            | Q(perfil_experiencia__icontains=palavra)
            | Q(perfil_habilidades__icontains=palavra)
            | Q(perfil_certificacoes__icontains=palavra)
        )
    return qs.distinct(), filtro.interpretacao
