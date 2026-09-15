"""Triagem de currículos por e-mail (IA).

Fluxo: ``ingerir_todas_caixas`` (roda por cron do SO, ver
``management/commands/ingerir_emails_triagem.py``) lê cada caixa IMAP ativa,
cria um ``CandidatoTriagemIA`` por e-mail (dedupe por ``Message-ID``), roteia
pra vaga certa e pontua contra ela. O RH decide depois, por item, uma de três
ações (``decidir``) — nada vira ``Candidato`` de verdade sem essa decisão.
"""

import hashlib
import io
import re
from email.utils import parseaddr

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.module_loading import import_string
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.atividade import services as atividade_services
from apps.candidatos import services as candidatos_services
from apps.core.logger import LoggerEngine
from apps.core.notificacoes_ws import publicar_notificacao
from apps.vagas import services as vagas_services
from apps.vagas.models import EtapaKanban, Vaga, VagaNotificacao
from utils.storage import MinioStorage

from . import imap_client
from .gmail_client import GmailApiClient
from .imap_client import ImapClient
from .models import CaixaEntradaEmail, CandidatoTriagemIA, ProviderCaixaEntrada, StatusTriagemIA
from .repositories.caixa_entrada_repository import CaixaEntradaRepository
from .repositories.triagem_ia_repository import TriagemIaRepository

log = LoggerEngine(__name__)

MAX_TENTATIVAS = 3
LOTE_POR_CAIXA = 50

_RE_TAG_ENDERECO = re.compile(r"\+([a-z0-9-]+)@", re.IGNORECASE)
_RE_TAG_ASSUNTO = re.compile(r"\[VAGA:([a-z0-9-]+)\]", re.IGNORECASE)


def _bucket():
    return settings.MINIO_BUCKET_CANDIDATOS_CURRICULOS


def _rotear_vaga(company_id, mensagem) -> Vaga | None:
    """Endereço com +tag (``vagas+codigo@dominio``) ou tag ``[VAGA:codigo]``
    no assunto. Sem nenhum dos dois, o e-mail fica "não roteado" pro RH
    resolver manualmente (ver ``rotear``)."""
    codigos = set()
    for header in ("Delivered-To", "To", "X-Original-To", "Envelope-To"):
        valor = mensagem.get(header, "") or ""
        m = _RE_TAG_ENDERECO.search(valor)
        if m:
            codigos.add(m.group(1).lower())
    m = _RE_TAG_ASSUNTO.search(mensagem.get("Subject", "") or "")
    if m:
        codigos.add(m.group(1).lower())
    if not codigos:
        return None
    return Vaga.objects.filter(
        company_id=company_id, is_banco_talentos=False, codigo_email__in=codigos
    ).first()


def _pontuar_triagem(triagem: CandidatoTriagemIA) -> CandidatoTriagemIA:
    """Baixa o currículo do MinIO, extrai o texto (PDF/.docx) e chama a IA
    pra pontuar contra ``triagem.vaga``. Marca ERRO em vez de propagar —
    quem chama decide se tenta de novo."""
    try:
        conteudo = MinioStorage().get_object(_bucket(), triagem.curriculo_key)
        texto = candidatos_services.extrair_texto_anexo(
            conteudo, triagem.curriculo_content_type
        )

        extractor_class = import_string(settings.TRIAGEM_IA_EXTRACTOR_CLASS)
        extractor = extractor_class()
        dto = extractor.pontuar(
            texto,
            {
                "titulo": triagem.vaga.titulo,
                "descricao": triagem.vaga.descricao,
                "requisitos": triagem.vaga.requisitos,
            },
        )

        triagem.nome_extraido = dto.nome
        triagem.email_extraido = dto.email
        triagem.telefone_extraido = dto.telefone
        triagem.cpf_extraido = dto.cpf
        triagem.linkedin_extraido = dto.linkedin_url
        triagem.perfil_formacao = dto.perfil_formacao
        triagem.perfil_experiencia = dto.perfil_experiencia
        triagem.perfil_habilidades = dto.perfil_habilidades
        triagem.perfil_certificacoes = dto.perfil_certificacoes
        triagem.score = dto.score
        triagem.justificativa_ia = dto.justificativa
        triagem.status = StatusTriagemIA.PRONTO
        triagem.erro_detalhe = ""
    except Exception as exc:
        log.error(
            "falha ao pontuar currículo da triagem por IA",
            triagem_id=str(triagem.id),
            erro=str(exc),
        )
        triagem.status = StatusTriagemIA.ERRO
        triagem.erro_detalhe = str(exc)
        triagem.tentativas = (triagem.tentativas or 0) + 1
    triagem.save()
    return triagem


def _notificar_lote_pronto(vaga: Vaga, quantidade: int):
    if quantidade <= 0:
        return
    destinatarios = list(
        User.objects.filter(company_id=vaga.company_id, role=User.Role.RH, is_active=True)
    )
    mensagem = f'{quantidade} candidato(s) novo(s) triado(s) por IA para "{vaga.titulo}"'
    VagaNotificacao.objects.bulk_create(
        [
            VagaNotificacao(company_id=vaga.company_id, destinatario=u, vaga=vaga, mensagem=mensagem)
            for u in destinatarios
        ]
    )
    for u in destinatarios:
        publicar_notificacao(u.id, "vaga", {"mensagem": mensagem, "vaga_id": str(vaga.id)})
    atividade_services.registrar(
        None,
        "triagem_ia_processada",
        vaga,
        resumo=f"IA processou {quantidade} currículo(s) recebido(s) por e-mail",
    )


def _extensao_para_content_type(content_type: str) -> str:
    """Compartilhado entre a ingestão por e-mail e o webhook — uma única
    fonte de verdade pra não divergir (já quase divergiu: as duas cópias
    testavam o mesmo conjunto de tipos com expressões diferentes)."""
    if content_type in candidatos_services.CONTENT_TYPES_DOCX:
        return ".docx"
    return ".pdf"


def _processar_mensagem(caixa: CaixaEntradaEmail, mensagem, repo: TriagemIaRepository):
    """Cria (ou não, se duplicado) um ``CandidatoTriagemIA`` a partir da
    mensagem. Retorna a instância criada, ou ``None`` se era duplicado
    (``Message-ID`` já processado antes)."""
    message_id = (mensagem.get("Message-ID") or "").strip()
    if not message_id:
        message_id = f"<sem-id-{mensagem.get('Date', '')}-{mensagem.get('From', '')}>"

    if repo.existe_message_id(caixa.company_id, message_id):
        return None

    nome_remetente, email_remetente = parseaddr(mensagem.get("From", "") or "")
    assunto = mensagem.get("Subject", "") or ""
    vaga = _rotear_vaga(caixa.company_id, mensagem)

    anexos = imap_client.extrair_anexos(mensagem)
    if not anexos:
        return repo.create(
            {
                "company_id": caixa.company_id,
                "vaga": vaga,
                "email_remetente": email_remetente,
                "nome_remetente": nome_remetente,
                "assunto_email": assunto[:500],
                "message_id": message_id,
                "status": StatusTriagemIA.ERRO,
                "erro_detalhe": "E-mail sem currículo anexado (PDF ou .docx).",
            }
        )

    filename, content_type, conteudo = anexos[0]
    extensao = _extensao_para_content_type(content_type)
    hash_curto = hashlib.sha256(message_id.encode()).hexdigest()[:32]
    curriculo_key = f"triagem-ia/{caixa.company_id}/{hash_curto}{extensao}"
    MinioStorage().upload_file(_bucket(), curriculo_key, io.BytesIO(conteudo), content_type)

    triagem = repo.create(
        {
            "company_id": caixa.company_id,
            "vaga": vaga,
            "email_remetente": email_remetente,
            "nome_remetente": nome_remetente,
            "assunto_email": assunto[:500],
            "message_id": message_id,
            "curriculo_key": curriculo_key,
            "curriculo_content_type": content_type,
            "status": StatusTriagemIA.PENDENTE,
        }
    )

    if vaga is None:
        return triagem

    return _pontuar_triagem(triagem)


def _cliente_para(caixa: CaixaEntradaEmail):
    """Escolhe o cliente certo (IMAP manual ou Gmail API por OAuth) pelo
    ``provider`` da caixa — os dois têm a mesma interface pública, então o
    resto do loop de ingestão não precisa saber a diferença."""
    if caixa.provider == ProviderCaixaEntrada.GOOGLE:
        return GmailApiClient(caixa)
    return ImapClient(caixa)


def ingerir_todas_caixas() -> int:
    """Verifica cada caixa ativa (IMAP ou Google) e processa os e-mails não
    lidos (até ``LOTE_POR_CAIXA`` por caixa). Roda por cron do SO."""
    repo = TriagemIaRepository()
    total = 0
    for caixa in CaixaEntradaRepository().list_ativas():
        client = _cliente_para(caixa)
        contagem_por_vaga = {}
        try:
            client.conectar()
            uids = client.buscar_nao_lidos(limite=LOTE_POR_CAIXA)
            for uid in uids:
                try:
                    mensagem = client.buscar_mensagem(uid)
                    triagem = _processar_mensagem(caixa, mensagem, repo)
                    client.marcar_lida(uid)
                    total += 1
                    if triagem is not None and triagem.status == StatusTriagemIA.PRONTO:
                        contagem_por_vaga[triagem.vaga_id] = (
                            contagem_por_vaga.get(triagem.vaga_id, 0) + 1
                        )
                except Exception as exc:
                    # Não marca \Seen — tenta de novo no próximo poll.
                    log.error(
                        "falha ao processar e-mail da triagem por IA",
                        caixa_id=str(caixa.id),
                        uid=str(uid),
                        erro=str(exc),
                    )
            caixa.ultimo_erro = ""
        except Exception as exc:
            log.error("falha ao conectar na caixa de e-mail da triagem por IA", caixa_id=str(caixa.id), erro=str(exc))
            caixa.ultimo_erro = str(exc)
        finally:
            client.fechar()
            caixa.ultima_verificacao_em = timezone.now()
            caixa.save(update_fields=["ultimo_erro", "ultima_verificacao_em", "updated_at"])

        for vaga_id, quantidade in contagem_por_vaga.items():
            vaga = Vaga.objects.filter(id=vaga_id).first()
            if vaga:
                _notificar_lote_pronto(vaga, quantidade)
    return total


def processar_curriculo_webhook(
    company_id,
    *,
    email_remetente: str,
    nome_remetente: str,
    assunto: str,
    content_type: str,
    conteudo: bytes,
    message_id: str = "",
) -> CandidatoTriagemIA:
    """Entrada alternativa ao e-mail: um filtro externo já confiável (ex.: o
    checkmail do Pedro) manda o currículo direto por webhook em vez da gente
    ler a caixa de e-mail inteira. Mesmo pipeline dali pra frente — roteia
    por tag ``[VAGA:codigo]`` no assunto, ou fica "não roteado" pro RH
    escolher (ver ``rotear``). Idempotente: reenviar o mesmo ``message_id``
    (ou o mesmo arquivo pro mesmo assunto, se não vier ``message_id``)
    devolve o item já criado em vez de duplicar — importante pra retry de
    webhook. A checagem de duplicado é best-effort (evita round-trip
    desnecessário no caso comum); quem garante de verdade é a constraint
    única no banco — uma corrida entre dois retries simultâneos cai no
    ``except IntegrityError`` abaixo."""
    repo = TriagemIaRepository()
    if not message_id:
        message_id = f"webhook-{hashlib.sha256(conteudo + (assunto or '').encode()).hexdigest()}"
    existente = CandidatoTriagemIA.objects.filter(
        company_id=company_id, message_id=message_id
    ).first()
    if existente:
        return existente

    if content_type not in candidatos_services.CONTENT_TYPES_DOCX and content_type != "application/pdf":
        raise ValidationError({"arquivo": f"Tipo de anexo não suportado: {content_type}"})

    vaga = None
    m = _RE_TAG_ASSUNTO.search(assunto or "")
    if m:
        vaga = Vaga.objects.filter(
            company_id=company_id, is_banco_talentos=False, codigo_email=m.group(1).lower()
        ).first()

    extensao = _extensao_para_content_type(content_type)
    hash_curto = hashlib.sha256(message_id.encode()).hexdigest()[:32]
    curriculo_key = f"triagem-ia/{company_id}/{hash_curto}{extensao}"
    MinioStorage().upload_file(_bucket(), curriculo_key, io.BytesIO(conteudo), content_type)

    try:
        with transaction.atomic():
            triagem = repo.create(
                {
                    "company_id": company_id,
                    "vaga": vaga,
                    "email_remetente": email_remetente,
                    "nome_remetente": nome_remetente,
                    "assunto_email": (assunto or "")[:500],
                    "message_id": message_id,
                    "curriculo_key": curriculo_key,
                    "curriculo_content_type": content_type,
                    "status": StatusTriagemIA.PENDENTE,
                }
            )
    except IntegrityError:
        # Corrida entre dois retries do mesmo webhook (checkmail reenviando
        # após timeout, por exemplo) -- o outro já criou entre a checagem
        # acima e agora. `atomic()` isola o erro num savepoint próprio, pra
        # essa consulta abaixo não herdar uma transação já abortada.
        # Devolve o existente em vez de propagar 500.
        return CandidatoTriagemIA.objects.get(company_id=company_id, message_id=message_id)

    if vaga is None:
        return triagem
    return _pontuar_triagem(triagem)


def rotear(triagem: CandidatoTriagemIA, vaga: Vaga) -> CandidatoTriagemIA:
    """RH atribui manualmente a vaga de um e-mail que chegou "não roteado" —
    dispara a pontuação da IA na hora, já que ela depende de saber a vaga."""
    if vaga.company_id != triagem.company_id:
        raise ValidationError({"vaga_id": "Vaga de outra empresa."})
    triagem.vaga = vaga
    triagem.save(update_fields=["vaga", "updated_at"])
    return _pontuar_triagem(triagem)


def decidir(triagem: CandidatoTriagemIA, acao: str, user, motivo: str = ""):
    """Aplica a decisão do RH sobre um item da Triagem por IA. Ver
    ``TriagemIaViewSet.decidir``."""
    if triagem.status == StatusTriagemIA.RESOLVIDO:
        raise ValidationError({"detail": "Este item já foi resolvido."})
    if acao != "banco_talentos" and triagem.vaga_id is None:
        raise ValidationError(
            {"detail": "Roteie este e-mail pra uma vaga antes de decidir (ver `rotear`)."}
        )
    if (
        acao in ("funil", "descartar")
        and triagem.vaga.status in candidatos_services.VAGA_BLOQUEIA_CANDIDATO
    ):
        raise ValidationError({"detail": "Vaga ainda não está recebendo candidaturas."})

    dados = {
        "nome": triagem.nome_extraido or triagem.nome_remetente,
        "email": triagem.email_extraido or triagem.email_remetente,
        "telefone": triagem.telefone_extraido,
        "cpf": triagem.cpf_extraido,
        "linkedin_url": triagem.linkedin_extraido,
        "perfil_formacao": triagem.perfil_formacao,
        "perfil_experiencia": triagem.perfil_experiencia,
        "perfil_habilidades": triagem.perfil_habilidades,
        "perfil_certificacoes": triagem.perfil_certificacoes,
        "curriculo_key": triagem.curriculo_key,
        "curriculo_content_type": triagem.curriculo_content_type,
    }

    if acao == "funil":
        candidato = candidatos_services.criar_candidato(
            company_id=triagem.company_id,
            vaga=triagem.vaga,
            dados=dados,
            cadastrado_por=user,
        )
    elif acao == "descartar":
        etapa_saida = (
            EtapaKanban.objects.filter(company_id=triagem.company_id, is_saida_negativa=True)
            .order_by("ordem")
            .first()
        )
        if etapa_saida is None:
            raise ValidationError({"detail": "Nenhuma etapa de saída negativa configurada."})
        candidato = candidatos_services.criar_candidato(
            company_id=triagem.company_id,
            vaga=triagem.vaga,
            dados=dados,
            cadastrado_por=user,
            etapa_atual=etapa_saida,
            motivo_reprovacao=(motivo or triagem.justificativa_ia or "").strip(),
            reprovado_em=timezone.now(),
        )
    elif acao == "banco_talentos":
        vaga_pool = vagas_services.garantir_vaga_banco_talentos(triagem.company_id, user)
        candidato = candidatos_services.criar_candidato(
            company_id=triagem.company_id,
            vaga=vaga_pool,
            dados=dados,
            cadastrado_por=user,
        )
    else:
        raise ValidationError({"acao": "Ação inválida."})

    triagem.status = StatusTriagemIA.RESOLVIDO
    triagem.candidato_resultante = candidato
    triagem.resolvido_em = timezone.now()
    triagem.resolvido_por = user
    triagem.save(
        update_fields=["status", "candidato_resultante", "resolvido_em", "resolvido_por", "updated_at"]
    )
    atividade_services.registrar(
        user,
        "triagem_ia_decidida",
        candidato,
        resumo=f"trouxe via Triagem por IA (score {triagem.score}): {acao}",
    )
    return candidato
