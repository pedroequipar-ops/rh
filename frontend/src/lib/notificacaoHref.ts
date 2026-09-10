import type { Role } from '../types'

/** Centraliza os paths de deep-link pra vaga/candidato — troca só aqui se mudar de novo. */
export function notificacaoHref(role: Role, kind: 'vaga' | 'candidato', id: string): string {
  const base = role === 'RH' ? '/rh' : '/setor'
  const board = kind === 'vaga' ? 'vagas' : 'pessoas'
  return `${base}/${board}/${kind}/${id}`
}
