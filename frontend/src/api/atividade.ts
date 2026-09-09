import { apiClient } from './client'

export type AtividadeAlvoTipo = 'vaga' | 'candidato'

export interface AtividadeFeedItem {
  tipo: 'atividade' | 'comentario' | 'historico'
  id: string
  autor: string
  descricao: string
  created_at: string
}

export async function getAtividadeFeed(
  alvoTipo: AtividadeAlvoTipo,
  alvoId: string,
): Promise<AtividadeFeedItem[]> {
  const { data } = await apiClient.get<AtividadeFeedItem[]>('/atividade/', {
    params: { alvo_tipo: alvoTipo, alvo_id: alvoId },
  })
  return data
}

export interface ComentarioInput {
  alvo_tipo: AtividadeAlvoTipo
  alvo_id: string
  texto: string
}

export interface Comentario {
  id: string
  autor: string
  alvo_tipo: AtividadeAlvoTipo
  alvo_id: string
  texto: string
  created_at: string
}

export async function criarComentario(input: ComentarioInput): Promise<Comentario> {
  const { data } = await apiClient.post<Comentario>('/atividade/comentarios/', input)
  return data
}
