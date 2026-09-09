import type { VagaPrioridade, VagaStatus } from '../types'

interface StatusMeta {
  label: string
  /** classes de badge (bg + text + border) */
  badge: string
  /** classes de cabeçalho de coluna do kanban */
  header: string
}

export const VAGA_STATUS_META: Record<VagaStatus, StatusMeta> = {
  RASCUNHO: {
    label: 'Rascunho',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    header: 'border-slate-200 bg-white text-slate-600',
  },
  SOLICITADA: {
    label: 'Solicitada',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    header: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  RECUSADA: {
    label: 'Recusada',
    badge: 'bg-red-100 text-red-700 border-red-200',
    header: 'border-red-200 bg-red-50 text-red-700',
  },
  APROVADA: {
    label: 'Aprovada',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    header: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  PUBLICADA: {
    label: 'Publicada',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    header: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
  RECEBENDO: {
    label: 'Recebendo candidaturas',
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    header: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  ENCERRADA: {
    label: 'Candidaturas encerradas',
    badge: 'bg-slate-200 text-slate-700 border-slate-300',
    header: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  EM_TRIAGEM: {
    label: 'Em triagem',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    header: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  CONGELADA: {
    label: 'Congelada',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    header: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  },
  CANCELADA: {
    label: 'Cancelada',
    badge: 'bg-red-100 text-red-700 border-red-200',
    header: 'border-red-200 bg-red-50 text-red-700',
  },
  PREENCHIDA: {
    label: 'Preenchida',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    header: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
}

/** Colunas do kanban antes da triagem, na ordem do fluxo. */
export const FLUXO_STATUSES: VagaStatus[] = [
  'RASCUNHO',
  'SOLICITADA',
  'RECUSADA',
  'APROVADA',
  'PUBLICADA',
  'RECEBENDO',
  'ENCERRADA',
  'CONGELADA',
]

/** Status de vaga que saíram do fluxo pré-triagem (não viram coluna). */
export const STATUS_FORA_DO_FLUXO: VagaStatus[] = [
  'EM_TRIAGEM',
  'CANCELADA',
  'PREENCHIDA',
]

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
