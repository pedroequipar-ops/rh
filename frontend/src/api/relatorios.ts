import { apiClient } from './client'

export type RelatorioEntidade = 'vaga' | 'candidato'
export type RelatorioModo = 'detalhado' | 'agrupado'

export interface RelatorioPeriodo {
  inicio?: string
  fim?: string
}

export interface RelatorioInput {
  entidade: RelatorioEntidade
  campos?: string[]
  filtros?: Record<string, string[] | boolean | string>
  periodo?: RelatorioPeriodo
  agrupamento?: string
  modo?: RelatorioModo
}

export interface RelatorioGrupoLinha {
  grupo: string
  total: number
}

/** Relatório completo em JSON — linhas detalhadas ou, com `agrupamento`, a
 * contagem por grupo. Alimenta os cards e gráficos do builder. */
export async function gerarRelatorio(
  input: RelatorioInput,
): Promise<Record<string, string>[] | RelatorioGrupoLinha[]> {
  const { data } = await apiClient.post('/relatorios/', { ...input, formato: 'json' })
  return data
}
