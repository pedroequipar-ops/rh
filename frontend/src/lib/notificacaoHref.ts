import type { Role } from '../types'

/** Centraliza os paths de deep-link pra vaga/candidato — a Fase 5 troca aqui, só. */
export function notificacaoHref(role: Role, kind: 'vaga' | 'candidato', id: string): string {
  const base = role === 'RH' ? '/rh/kanban' : '/setor/kanban'
  return `${base}/${kind}/${id}`
}
