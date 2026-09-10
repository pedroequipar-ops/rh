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

export async function previewRelatorio(
  input: RelatorioInput,
): Promise<Record<string, string>[] | RelatorioGrupoLinha[]> {
  const { data } = await apiClient.post('/relatorios/?preview=1', { ...input, formato: 'json' })
  return data
}

export async function baixarRelatorioCsv(input: RelatorioInput): Promise<void> {
  const response = await apiClient.post('/relatorios/', { ...input, formato: 'csv' }, { responseType: 'blob' })
  const blob = response.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-${input.entidade}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
