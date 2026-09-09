import { apiClient } from './client'
import type { VagaStatus } from '../types'

export interface BuscaVagaResultado {
  id: string
  titulo: string
  status: VagaStatus
}

export interface BuscaCandidatoResultado {
  id: string
  nome: string
}

export interface BuscaSetorResultado {
  id: string
  nome: string
}

export interface BuscaResultado {
  vagas: BuscaVagaResultado[]
  candidatos: BuscaCandidatoResultado[]
  setores: BuscaSetorResultado[]
}

export async function buscar(q: string): Promise<BuscaResultado> {
  const { data } = await apiClient.get<BuscaResultado>('/busca/', { params: { q } })
  return data
}
