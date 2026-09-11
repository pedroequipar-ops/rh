import type { Role } from '../types'

/** Centraliza os paths de deep-link pra vaga/candidato — troca só aqui se mudar de novo.
 * `emTriagem` manda a vaga pro board Triagem em vez de Vagas — vaga EM_TRIAGEM não
 * aparece como card no board Vagas, então abrir lá deixa o modal sem contexto. */
export function notificacaoHref(
  role: Role,
  kind: 'vaga' | 'candidato',
  id: string,
  opts?: { emTriagem?: boolean },
): string {
  const base = role === 'RH' ? '/rh' : '/setor'
  const board = kind === 'candidato' ? 'pessoas' : opts?.emTriagem ? 'triagem' : 'vagas'
  return `${base}/${board}/${kind}/${id}`
}
