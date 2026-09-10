/** Fábrica central de chaves do react-query. */
export const queryKeys = {
  vagas: ['vagas'] as const,
  vagasList: ['vagas', 'list'] as const,
  vaga: (id: string) => ['vagas', 'detail', id] as const,
  vagaHistorico: (id: string) => ['vagas', 'detail', id, 'historico'] as const,
  vagaCandidatos: (id: string) => ['vagas', 'detail', id, 'candidatos'] as const,

  candidatos: ['candidatos'] as const,
  candidatosList: ['candidatos', 'list'] as const,
  candidato: (id: string) => ['candidatos', 'detail', id] as const,

  etapas: ['etapas'] as const,
  setores: ['setores'] as const,
  usuarios: ['usuarios'] as const,

  tarefas: ['tarefas'] as const,
  tarefasList: (params: object) => ['tarefas', 'list', params] as const,
}
