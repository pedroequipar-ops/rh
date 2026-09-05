import { apiClient, unwrapList } from './client'
import type { Setor, Usuario } from '../types'

export interface SetorInput {
  nome: string
}

export async function createSetor(input: SetorInput): Promise<Setor> {
  const { data } = await apiClient.post<Setor>('/setores/', input)
  return data
}

export async function updateSetor(id: string, input: SetorInput): Promise<Setor> {
  const { data } = await apiClient.patch<Setor>(`/setores/${id}/`, input)
  return data
}

export async function deleteSetor(id: string): Promise<void> {
  await apiClient.delete(`/setores/${id}/`)
}

export interface UsuarioInput {
  username: string
  password: string
  setor_id: string
}

export async function createUsuario(input: UsuarioInput): Promise<void> {
  await apiClient.post('/usuarios/', input)
}

export interface UsuarioUpdateInput {
  username?: string
  password?: string
  setor_id?: string
}

export async function updateUsuario(id: string, input: UsuarioUpdateInput): Promise<void> {
  await apiClient.patch(`/usuarios/${id}/`, input)
}

export async function listUsuarios(): Promise<Usuario[]> {
  const { data } = await apiClient.get('/usuarios/')
  return unwrapList<Usuario>(data)
}

export async function deleteUsuario(id: string): Promise<void> {
  await apiClient.delete(`/usuarios/${id}/`)
}

export async function alterarMinhaSenha(senhaAtual: string, senhaNova: string): Promise<void> {
  await apiClient.post('/auth/senha/', { senha_atual: senhaAtual, senha_nova: senhaNova })
}
