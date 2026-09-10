export type Role = 'RH' | 'SETOR'

export interface Setor {
  id: string
  nome: string
}

export interface Empresa {
  id: string
  nome: string
}

export interface Tag {
  id: string
  nome: string
  cor: string | null
}

export interface Usuario {
  id: string
  username: string
  first_name: string
  last_name: string
  role: Role
  setor: Setor | null
}

export interface UsuarioResumo {
  id: string
  username: string
  first_name: string
  last_name: string
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
  exige_cadastro_completo: boolean
}

export type VagaStatus =
  | 'RASCUNHO'
  | 'SOLICITADA'
  | 'RECUSADA'
  | 'APROVADA'
  | 'PUBLICADA'
  | 'ENCERRADA'
  | 'EM_TRIAGEM'
  | 'CONGELADA'
  | 'CANCELADA'
  | 'PREENCHIDA'

export type VagaPrioridade = 1 | 2 | 3

export interface VagaTotalPorEtapa {
  etapa_id: string
  nome: string
  ordem: number
  total: number
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
  responsavel: UsuarioResumo | null
  created_at?: string

  status: VagaStatus
  status_display: string
  status_pre_congelamento: string
  etapa_atual: EtapaKanban | null
  qtd_pessoas_fase: number
  prioridade: VagaPrioridade
  prioridade_display: string
  urgente: boolean
  motivo_solicitacao: string
  motivo_recusa: string
  data_inicio_prevista: string | null
  data_alvo_preenchimento: string | null
  solicitada_em: string | null
  aprovada_em: string | null
  recusada_em: string | null
  publicada_em: string | null
  encerrada_em: string | null
  triagem_iniciada_em: string | null
  fechada_em: string | null
  aprovada_por: string | null
  cobrada_em: string | null
  total_cobrancas: number
  prazo_alertado_em: string | null
  atrasada: boolean
  total_candidatos: number
  total_por_etapa: VagaTotalPorEtapa[] | null
  transicoes_disponiveis: VagaStatus[]
  tags: Tag[]
}

export interface VagaHistorico {
  id: string
  de_status: string
  para_status: string
  por: string | null
  observacao: string
  created_at: string
}

export interface VagaResumo {
  id: string
  titulo: string
  setor: string
  quantidade_vagas: number
  salario: string | number | null
  status: VagaStatus
  status_display: string
  prioridade: VagaPrioridade
  prioridade_display: string
  urgente: boolean
  motivo_solicitacao: string
  motivo_solicitacao_display: string
  data_inicio_prevista: string | null
  data_alvo_preenchimento: string | null
  atrasada: boolean
  solicitada_em: string | null
  aprovada_em: string | null
  publicada_em: string | null
  encerrada_em: string | null
  triagem_iniciada_em: string | null
  cobrada_em: string | null
  total_cobrancas: number
  created_at?: string
}

export interface Candidato {
  id: string
  vaga_id: string
  vaga_titulo: string
  vaga_setor: string
  vaga: VagaResumo
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
  tags: Tag[]
  responsavel: UsuarioResumo | null
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
  candidato_id: string | null
  vaga_id: string | null
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
