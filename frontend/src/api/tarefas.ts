import { apiClient, unwrapList } from './client'
import type { UsuarioResumo } from '../types'

export type TarefaAlvoTipo = 'VAGA' | 'CANDIDATO'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string
  due_at: string | null
  done_at: string | null
  concluida: boolean
  responsavel: UsuarioResumo | null
  alvo_tipo: TarefaAlvoTipo | ''
  alvo_id: string | null
  criado_por: string
  created_at: string
  updated_at: string
}

export interface TarefaInput {
  titulo: string
  descricao?: string
  due_at?: string | null
  responsavel_id?: string | null
  alvo_tipo?: TarefaAlvoTipo | ''
  alvo_id?: string | null
}

export interface ListTarefasParams {
  responsavel?: string
  alvo_tipo?: TarefaAlvoTipo
  alvo_id?: string
  pendentes?: boolean
}

export async function listTarefas(params: ListTarefasParams = {}): Promise<Tarefa[]> {
  const { data } = await apiClient.get('/tarefas/', {
    params: {
      responsavel: params.responsavel,
      alvo_tipo: params.alvo_tipo,
      alvo_id: params.alvo_id,
      pendentes: params.pendentes ? '1' : undefined,
    },
  })
  return unwrapList<Tarefa>(data)
}

export async function createTarefa(input: TarefaInput): Promise<Tarefa> {
  const { data } = await apiClient.post<Tarefa>('/tarefas/', input)
  return data
}

export async function updateTarefa(id: string, input: Partial<TarefaInput>): Promise<Tarefa> {
  const { data } = await apiClient.patch<Tarefa>(`/tarefas/${id}/`, input)
  return data
}

export async function concluirTarefa(id: string): Promise<Tarefa> {
  const { data } = await apiClient.post<Tarefa>(`/tarefas/${id}/concluir/`)
  return data
}

export async function reabrirTarefa(id: string): Promise<Tarefa> {
  const { data } = await apiClient.post<Tarefa>(`/tarefas/${id}/reabrir/`)
  return data
}

export async function deleteTarefa(id: string): Promise<void> {
  await apiClient.delete(`/tarefas/${id}/`)
}
