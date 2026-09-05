import { apiClient, unwrapList } from './client'
import type { Candidato, Setor, Vaga } from '../types'

export async function listVagas(): Promise<Vaga[]> {
  const { data } = await apiClient.get('/vagas/')
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
}

export async function createVaga(input: VagaInput): Promise<Vaga> {
  const { data } = await apiClient.post<Vaga>('/vagas/', input)
  return data
}

export async function updateVaga(id: string, input: Partial<VagaInput>): Promise<Vaga> {
  const { data } = await apiClient.patch<Vaga>(`/vagas/${id}/`, input)
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
