import { apiClient } from './client'
import type { ChatMensagem, Paginated } from '../types'

const MENSAGENS_PAGE_SIZE = 30

export interface MensagensPage {
  mensagens: ChatMensagem[]
  temMaisAntigas: boolean
  proximaPagina: number
}

export async function listMensagens(candidatoId: string, page = 1): Promise<MensagensPage> {
  const { data } = await apiClient.get<Paginated<ChatMensagem>>(`/candidatos/${candidatoId}/mensagens/`, {
    params: { ordering: '-created_at', page, page_size: MENSAGENS_PAGE_SIZE },
  })
  return {
    mensagens: [...data.results].reverse(),
    temMaisAntigas: data.next !== null,
    proximaPagina: page + 1,
  }
}

export async function marcarMensagensComoLidas(candidatoId: string): Promise<void> {
  await apiClient.post(`/candidatos/${candidatoId}/mensagens/marcar-lida/`)
}

export interface CandidatoNaoLidas {
  candidato_id: string
  candidato_nome: string
  quantidade: number
}

export interface NaoLidasResumo {
  total: number
  candidatos: CandidatoNaoLidas[]
}

export async function getNaoLidas(): Promise<NaoLidasResumo> {
  const { data } = await apiClient.get<NaoLidasResumo>('/chat/nao-lidas/')
  return data
}
