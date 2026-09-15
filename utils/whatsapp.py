from datetime import datetime, timezone

from django.conf import settings

from apps.core.logger import LoggerEngine
from utils.queue import QueueEngine

log = LoggerEngine(__name__)


def _link_para(alvo_tipo: str, alvo_id) -> str:
    if alvo_tipo == "vaga":
        caminho = f"/rh/vagas/vaga/{alvo_id}"
    else:
        caminho = f"/rh/pessoas/candidato/{alvo_id}"
    return f"{settings.FRONTEND_BASE_URL}{caminho}"


def notificar_whatsapp(
    destinatario, *, alvo_tipo: str, alvo_id, titulo: str, texto: str, setor: str = "", sender: str = ""
) -> None:
    """Publica um aviso de WhatsApp pra `destinatario` (User) — o serviço Go
    whatsapp-bot (whatsmeow) consome a fila e manda de verdade. Só manda se
    o usuário tiver telefone e ele já estiver confirmado (mandou mensagem
    pro bot pelo menos uma vez — ver whatsapp_confirmado_em); nunca propaga
    exceção, mesma política fail-open do resto do sistema (um aviso que não
    saiu não pode quebrar o fluxo de chat/atividade)."""
    if destinatario is None or not destinatario.telefone or not destinatario.whatsapp_confirmado_em:
        return

    try:
        QueueEngine().publish(
            settings.QUEUE_WHATSAPP_NOTIFY,
            {
                "sector": setor,
                "sender": sender,
                "recipient": "",
                "title": titulo,
                "summary": texto,
                "link": _link_para(alvo_tipo, alvo_id),
                "recipients": [destinatario.telefone],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception:
        log.error("Falha ao publicar notificação WhatsApp", alvo_tipo=alvo_tipo, alvo_id=str(alvo_id))
