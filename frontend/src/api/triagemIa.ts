import { apiClient } from './client'
import type { CaixaEntradaEmail, CandidatoTriagemIA, TriagemIaConfig } from '../types'

export async function listTriagemIaDaVaga(vagaId: string): Promise<CandidatoTriagemIA[]> {
  const { data } = await apiClient.get<CandidatoTriagemIA[]>('/triagem-ia/', {
    params: { vaga_id: vagaId },
  })
  return data
}

export async function listTriagemIaNaoRoteados(): Promise<CandidatoTriagemIA[]> {
  const { data } = await apiClient.get<CandidatoTriagemIA[]>('/triagem-ia/', {
    params: { nao_roteado: 'true' },
  })
  return data
}

export type TriagemIaAcao = 'funil' | 'banco_talentos' | 'descartar'

export async function decidirTriagemIa(
  id: string,
  acao: TriagemIaAcao,
  motivo?: string,
): Promise<{ candidato_id: string; vaga_id: string }> {
  const { data } = await apiClient.post(`/triagem-ia/${id}/decidir/`, { acao, motivo })
  return data
}

export async function rotearTriagemIa(id: string, vagaId: string): Promise<CandidatoTriagemIA> {
  const { data } = await apiClient.post<CandidatoTriagemIA>(`/triagem-ia/${id}/rotear/`, {
    vaga_id: vagaId,
  })
  return data
}

export async function getTriagemIaConfig(vagaId?: string): Promise<TriagemIaConfig> {
  const { data } = await apiClient.get<TriagemIaConfig>('/triagem-ia/config/', {
    params: vagaId ? { vaga_id: vagaId } : undefined,
  })
  return data
}

export async function getCaixasEntradaEmail(): Promise<CaixaEntradaEmail[]> {
  const { data } = await apiClient.get<CaixaEntradaEmail[]>('/triagem-ia-caixa-entrada/')
  return data
}

export interface CaixaEntradaEmailInput {
  host: string
  porta?: number
  usar_ssl?: boolean
  usuario: string
  senha?: string
  pasta?: string
  ativo?: boolean
}

export async function adicionarCaixaEntradaEmail(
  input: CaixaEntradaEmailInput,
): Promise<CaixaEntradaEmail> {
  const { data } = await apiClient.post<CaixaEntradaEmail>('/triagem-ia-caixa-entrada/', input)
  return data
}

export async function atualizarCaixaEntradaEmail(
  id: string,
  input: Partial<CaixaEntradaEmailInput>,
): Promise<CaixaEntradaEmail> {
  const { data } = await apiClient.patch<CaixaEntradaEmail>(
    `/triagem-ia-caixa-entrada/${id}/`,
    input,
  )
  return data
}

export async function removerCaixaEntradaEmail(id: string): Promise<void> {
  await apiClient.delete(`/triagem-ia-caixa-entrada/${id}/`)
}

export async function iniciarConexaoGoogle(): Promise<{ authorize_url: string }> {
  const { data } = await apiClient.get<{ authorize_url: string }>('/triagem-ia-google/authorize/')
  return data
}
