import type { VagaPrioridade, VagaStatus } from '../types'

interface StatusMeta {
  label: string
  /** classes de badge (bg + text + border) */
  badge: string
  /** cor do ponto indicador no header da coluna (estilo Trello, sem barra colorida) */
  dot: string
}

export const VAGA_STATUS_META: Record<VagaStatus, StatusMeta> = {
  RASCUNHO: {
    label: 'Rascunho',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  SOLICITADA: {
    label: 'Solicitada',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  RECUSADA: {
    label: 'Recusada',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  APROVADA: {
    label: 'Aprovada',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
  },
  PUBLICADA: {
    label: 'Publicada',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  ENCERRADA: {
    label: 'Lixeira',
    badge: 'bg-slate-200 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },
  EM_TRIAGEM: {
    label: 'Em triagem',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  CONGELADA: {
    label: 'Congelada',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dot: 'bg-cyan-500',
  },
  CANCELADA: {
    label: 'Cancelada',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  PREENCHIDA: {
    label: 'Preenchida',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
}

/**
 * Colunas de status de vaga, na ordem do fluxo (antes das colunas de etapa).
 * EM_TRIAGEM não entra aqui: nesse status o card da vaga vive nas colunas de
 * etapa de triagem (Triagem, Primeira Entrevista) via `vaga.etapa_atual`.
 */
export const FLUXO_STATUSES: VagaStatus[] = ['SOLICITADA', 'APROVADA', 'PUBLICADA', 'PREENCHIDA']

/** Status de vaga que não viram coluna de status (terminais ou geridos por etapa,
 * ou alcançados só pelo dock de Ganho/Perda ao arrastar). */
export const STATUS_FORA_DO_FLUXO: VagaStatus[] = ['EM_TRIAGEM', 'CANCELADA']

/** Status de baixo volume: viram um chip embaixo da coluna relacionada em vez
 * de coluna cheia — ainda aceitam arraste, só não poluem o kanban. */
export const STATUS_ORBS: VagaStatus[] = ['RECUSADA', 'ENCERRADA', 'CONGELADA']

/** Sob qual coluna cheia cada chip de status fica — reflete de onde a
 * transição normalmente parte (recusa vem de Solicitada, congelamento de
 * Publicada; a lixeira de encerradas fica junto de Preenchida, fim de linha). */
export const CHIP_ABAIXO_DA_COLUNA: Partial<Record<VagaStatus, VagaStatus>> = {
  SOLICITADA: 'RECUSADA',
  PUBLICADA: 'CONGELADA',
  PREENCHIDA: 'ENCERRADA',
}

export function statusLabel(status: VagaStatus): string {
  return VAGA_STATUS_META[status]?.label ?? status
}

export const PRIORIDADE_META: Record<VagaPrioridade, { label: string; badge: string }> = {
  1: { label: 'Baixa', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  2: { label: 'Média', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  3: { label: 'Alta', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
}

export const MOTIVO_SOLICITACAO_OPCOES = [
  { value: '', label: 'Não informado' },
  { value: 'AUMENTO_QUADRO', label: 'Aumento de quadro' },
  { value: 'SUBSTITUICAO', label: 'Substituição' },
  { value: 'PROJETO', label: 'Projeto novo' },
  { value: 'OUTRO', label: 'Outro' },
]
