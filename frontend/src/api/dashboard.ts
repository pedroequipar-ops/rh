import { apiClient } from './client'
import type { VagaStatus } from '../types'

export interface DashboardResumo {
  ativas: number
  aguardando_aprovacao: number
  preenchidas: number
  atrasadas: number
}

export interface VagaPorStatus {
  status: VagaStatus
  status_display: string
  total: number
}

export interface VagaAtrasada {
  id: string
  titulo: string
  setor: string
  status: VagaStatus
  data_inicio_prevista: string | null
  data_alvo_preenchimento: string | null
}

export interface FunilEtapa {
  etapa_id: string
  nome: string
  ordem: number
  is_saida_negativa: boolean
  total: number
}

export interface CandidaturaVsCadastrado {
  vaga_id: string
  titulo: string
  candidaturas: number
  cadastrados: number
}

export interface DashboardData {
  resumo: DashboardResumo
  vagas_por_status: VagaPorStatus[]
  vagas_atrasadas: VagaAtrasada[]
  funil_etapas: FunilEtapa[]
  candidaturas_vs_cadastrados: CandidaturaVsCadastrado[]
}

export interface DashboardFiltro {
  inicio?: string
  fim?: string
  setor?: string
}

export async function getDashboard(filtro: DashboardFiltro = {}): Promise<DashboardData> {
  const { data } = await apiClient.get<DashboardData>('/dashboard/', { params: filtro })
  return data
}
