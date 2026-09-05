import { apiClient, unwrapList } from './client'
import type { Candidato, CandidatoExtraido } from '../types'

export interface UploadUrlResponse {
  upload_url: string
  curriculo_key: string
}

export async function getUploadUrl(filename: string, contentType: string): Promise<UploadUrlResponse> {
  const { data } = await apiClient.post<UploadUrlResponse>('/candidatos/upload-url/', {
    filename,
    content_type: contentType,
  })
  return data
}

export async function uploadCurriculo(uploadUrl: string, file: File): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  })
}

export async function analisarCurriculo(curriculoKey: string): Promise<CandidatoExtraido> {
  const { data } = await apiClient.post<CandidatoExtraido>('/candidatos/analisar-curriculo/', {
    curriculo_key: curriculoKey,
  })
  return data
}

export interface CandidatoInput {
  nome: string
  email: string
  telefone: string
  cpf: string
  linkedin_url?: string | null
  perfil_formacao?: string
  perfil_experiencia?: string
  perfil_habilidades?: string
  perfil_certificacoes?: string
  curriculo_key: string
  vaga_id: string
}

export async function createCandidato(input: CandidatoInput): Promise<Candidato> {
  const { data } = await apiClient.post<Candidato>('/candidatos/', input)
  return data
}

export async function getCandidato(id: string): Promise<Candidato> {
  const { data } = await apiClient.get<Candidato>(`/candidatos/${id}/`)
  return data
}

export async function updateCandidato(id: string, input: Partial<CandidatoInput>): Promise<Candidato> {
  const { data } = await apiClient.patch<Candidato>(`/candidatos/${id}/`, input)
  return data
}

export async function listCandidatos(): Promise<Candidato[]> {
  const { data } = await apiClient.get('/candidatos/')
  return unwrapList<Candidato>(data)
}

export async function getCurriculoUrl(id: string): Promise<string> {
  const { data } = await apiClient.get<{ curriculo_url: string }>(`/candidatos/${id}/curriculo-url/`)
  return data.curriculo_url
}

export async function moverEtapa(id: string, etapaId: string): Promise<Candidato> {
  const { data } = await apiClient.patch<Candidato>(`/candidatos/${id}/mover-etapa/`, {
    etapa_id: etapaId,
  })
  return data
}

export async function deleteCandidato(id: string): Promise<void> {
  await apiClient.delete(`/candidatos/${id}/`)
}

export interface CandidatoNotificacaoEtapa {
  id: string
  candidato_id: string
  candidato_nome: string
  mensagem: string
  created_at: string
}

export async function getNotificacoesEtapa(): Promise<CandidatoNotificacaoEtapa[]> {
  const { data } = await apiClient.get<CandidatoNotificacaoEtapa[]>('/candidatos-notificacoes/')
  return data
}

export async function marcarNotificacoesEtapaComoLidas(): Promise<void> {
  await apiClient.post('/candidatos-notificacoes/marcar-lidas/')
}
