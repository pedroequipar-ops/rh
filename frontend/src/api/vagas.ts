import { apiClient, unwrapList } from './client'
import type { Candidato, Setor, Vaga, VagaHistorico, VagaPrioridade, VagaStatus } from '../types'

export async function listVagas(status?: VagaStatus[]): Promise<Vaga[]> {
  const params = status && status.length ? { status: status.join(',') } : undefined
  const { data } = await apiClient.get('/vagas/', { params })
  return unwrapList<Vaga>(data)
}

export async function getVaga(id: string): Promise<Vaga> {
  const { data } = await apiClient.get<Vaga>(`/vagas/${id}/`)
  return data
}

export async function listSetores(): Promise<Setor[]> {
  const { data } = await apiClient.get('/setores/')
  return unwrapList<Setor>(data)
}

export interface VagaInput {
  titulo: string
  descricao: string
  requisitos: string
  quantidade_vagas: number
  salario: string | number | null
  setor_id?: string
  prioridade?: VagaPrioridade
  urgente?: boolean
  motivo_solicitacao?: string
  data_inicio_prevista?: string | null
  data_alvo_preenchimento?: string | null
}

export async function createVaga(input: VagaInput): Promise<Vaga> {
  const { data } = await apiClient.post<Vaga>('/vagas/', input)
  return data
}

export async function updateVaga(id: string, input: Partial<VagaInput>): Promise<Vaga> {
  const { data } = await apiClient.patch<Vaga>(`/vagas/${id}/`, input)
  return data
}

export interface AprovarVagaInput {
  prioridade?: VagaPrioridade
  urgente?: boolean
  data_inicio_prevista?: string | null
  data_alvo_preenchimento?: string | null
  observacao?: string
}

export async function aprovarVaga(id: string, input: AprovarVagaInput = {}): Promise<Vaga> {
  const { data } = await apiClient.post<Vaga>(`/vagas/${id}/aprovar/`, input)
  return data
}

export async function recusarVaga(id: string, motivo: string): Promise<Vaga> {
  const { data } = await apiClient.post<Vaga>(`/vagas/${id}/recusar/`, { motivo })
  return data
}

export async function transicionarVaga(
  id: string,
  para: VagaStatus,
  observacao?: string,
): Promise<Vaga> {
  const { data } = await apiClient.post<Vaga>(`/vagas/${id}/transicionar/`, { para, observacao })
  return data
}

export async function cobrarVaga(id: string, mensagem?: string): Promise<number> {
  const { data } = await apiClient.post<{ cobrancas_enviadas: number }>(`/vagas/${id}/cobrar/`, {
    mensagem,
  })
  return data.cobrancas_enviadas
}

export async function getVagaHistorico(id: string): Promise<VagaHistorico[]> {
  const { data } = await apiClient.get<VagaHistorico[]>(`/vagas/${id}/historico/`)
  return data
}

export async function deleteVaga(id: string): Promise<void> {
  await apiClient.delete(`/vagas/${id}/`)
}

export async function listCandidatosDaVaga(id: string): Promise<Candidato[]> {
  const { data } = await apiClient.get(`/vagas/${id}/candidatos/`)
  return unwrapList<Candidato>(data)
}

export interface VagaNotificacaoNova {
  id: string
  vaga_id: string
  vaga_titulo: string
  mensagem: string
  created_at: string
}

export async function getVagaNotificacoes(): Promise<VagaNotificacaoNova[]> {
  const { data } = await apiClient.get<VagaNotificacaoNova[]>('/vagas-notificacoes/')
  return data
}

export async function marcarVagaNotificacoesComoLidas(): Promise<void> {
  await apiClient.post('/vagas-notificacoes/marcar-lidas/')
}
