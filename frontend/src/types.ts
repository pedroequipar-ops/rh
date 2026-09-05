export type Role = 'RH' | 'SETOR'

export interface Setor {
  id: string
  nome: string
}

export interface Usuario {
  id: string
  username: string
  first_name: string
  last_name: string
  role: Role
  setor: Setor | null
}

export interface Me {
  id: string
  username: string
  role: Role
  setor: Setor | null
  company_id: string
}

export interface EtapaKanban {
  id: string
  nome: string
  ordem: number
  is_saida_negativa: boolean
  cor?: string | null
}

export interface Vaga {
  id: string
  titulo: string
  descricao: string
  requisitos: string
  quantidade_vagas: number
  salario: string | number | null
  setor: Setor
  criado_por?: string
  created_at?: string
}

export interface Candidato {
  id: string
  vaga_id: string
  vaga_titulo: string
  vaga_setor: string
  etapa_atual: EtapaKanban
  ordem: number
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
  curriculo_content_type?: string
  created_at?: string
}

export interface CandidatoExtraido {
  nome: string
  email: string
  telefone: string
  cpf: string
  linkedin_url: string | null
  vaga_sugerida_id: string | null
  justificativa: string
  perfil_formacao: string
  perfil_experiencia: string
  perfil_habilidades: string
  perfil_certificacoes: string
  erro: boolean
}

export interface ChatMensagem {
  id: string
  candidato_id: string
  autor: string
  autor_id: string
  texto: string
  created_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
