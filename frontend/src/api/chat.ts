import { apiClient } from './client'
import type { ChatMensagem, Paginated } from '../types'
import type { ChatKind } from '../ws/chatSocket'

const MENSAGENS_PAGE_SIZE = 30

export interface MensagensPage {
  mensagens: ChatMensagem[]
  temMaisAntigas: boolean
  proximaPagina: number
}

function basePath(kind: ChatKind, id: string): string {
  return kind === 'vaga' ? `/vagas/${id}/mensagens/` : `/candidatos/${id}/mensagens/`
}

export async function listMensagens(
  kind: ChatKind,
  id: string,
  page = 1,
): Promise<MensagensPage> {
  const { data } = await apiClient.get<Paginated<ChatMensagem>>(basePath(kind, id), {
    params: { ordering: '-created_at', page, page_size: MENSAGENS_PAGE_SIZE },
  })
  return {
    mensagens: [...data.results].reverse(),
    temMaisAntigas: data.next !== null,
    proximaPagina: page + 1,
  }
}

export async function marcarMensagensComoLidas(kind: ChatKind, id: string): Promise<void> {
  await apiClient.post(`${basePath(kind, id)}marcar-lida/`)
}

export interface CandidatoNaoLidas {
  candidato_id: string
  candidato_nome: string
  quantidade: number
}

export interface VagaNaoLidas {
  vaga_id: string
  vaga_titulo: string
  quantidade: number
}

export interface NaoLidasResumo {
  total: number
  candidatos: CandidatoNaoLidas[]
  vagas: VagaNaoLidas[]
}

export async function getNaoLidas(): Promise<NaoLidasResumo> {
  const { data } = await apiClient.get<NaoLidasResumo>('/chat/nao-lidas/')
  return data
}
