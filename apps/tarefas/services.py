from django.utils import timezone

from apps.atividade.models import AlvoTipo

from .models import Tarefa


def tarefas_vencendo(company_id, responsavel_id=None, limite=None):
    """Tarefas pendentes com prazo já vencido ou vencendo até hoje."""
    hoje = timezone.localdate()
    qs = Tarefa.objects.filter(
        company_id=company_id, done_at__isnull=True, due_at__date__lte=hoje
    ).select_related("responsavel")
    if responsavel_id:
        qs = qs.filter(responsavel_id=responsavel_id)
    return qs[:limite] if limite else qs


def _notificar_responsavel(tarefa):
    """Notifica pelo canal do alvo (sino de vaga/candidato) quando a tarefa
    está ligada a um registro. Tarefa avulsa (sem alvo) fica visível só em
    "Minhas tarefas" — não há canal de sino genérico no sistema."""
    if not tarefa.responsavel_id:
        return
    mensagem = f'Tarefa "{tarefa.titulo}" está vencendo.'

    if tarefa.alvo_tipo == AlvoTipo.VAGA and tarefa.alvo_id:
        from apps.vagas.models import Vaga, VagaNotificacao

        if Vaga.objects.filter(id=tarefa.alvo_id, company_id=tarefa.company_id).exists():
            VagaNotificacao.objects.create(
                company_id=tarefa.company_id,
                destinatario=tarefa.responsavel,
                vaga_id=tarefa.alvo_id,
                mensagem=mensagem,
            )
    elif tarefa.alvo_tipo == AlvoTipo.CANDIDATO and tarefa.alvo_id:
        from apps.candidatos.models import Candidato, CandidatoNotificacao

        if Candidato.objects.filter(id=tarefa.alvo_id, company_id=tarefa.company_id).exists():
            CandidatoNotificacao.objects.create(
                company_id=tarefa.company_id,
                destinatario=tarefa.responsavel,
                candidato_id=tarefa.alvo_id,
                mensagem=mensagem,
            )


def rodar_lembretes() -> int:
    """Notifica (uma vez) o responsável de cada tarefa pendente vencendo hoje
    ou já vencida. Feito para rodar por cron do SO."""
    hoje = timezone.localdate()
    tarefas = Tarefa.objects.filter(
        done_at__isnull=True, due_at__date__lte=hoje, lembrete_enviado_em__isnull=True
    )
    total = 0
    for tarefa in tarefas:
        _notificar_responsavel(tarefa)
        tarefa.lembrete_enviado_em = timezone.now()
        tarefa.save(update_fields=["lembrete_enviado_em", "updated_at"])
        total += 1
    return total
