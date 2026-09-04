import { apiClient, unwrapList } from './client'
import type { EtapaKanban } from '../types'

export async function listEtapas(): Promise<EtapaKanban[]> {
  const { data } = await apiClient.get('/etapas-kanban/')
  return unwrapList<EtapaKanban>(data)
}

export interface EtapaInput {
  nome: string
  ordem: number
  is_saida_negativa?: boolean
  cor?: string | null
}

export async function createEtapa(input: EtapaInput): Promise<EtapaKanban> {
  const { data } = await apiClient.post<EtapaKanban>('/etapas-kanban/', input)
  return data
}

export async function updateEtapa(id: string, input: Partial<EtapaInput>): Promise<EtapaKanban> {
  const { data } = await apiClient.patch<EtapaKanban>(`/etapas-kanban/${id}/`, input)
  return data
}

export async function deleteEtapa(id: string): Promise<void> {
  await apiClient.delete(`/etapas-kanban/${id}/`)
}

export async function reordenarEtapas(ordem: string[]): Promise<void> {
  await apiClient.post('/etapas-kanban/reordenar/', { ordem })
}
