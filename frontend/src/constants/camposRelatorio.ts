/** Espelha `apps/relatorios/services.py CAMPOS_PERMITIDOS` — mesma chave,
 * mesmo label, pra manter front e back em sincronia. */

export interface CampoRelatorio {
  value: string
  label: string
}

export const CAMPOS_VAGA: CampoRelatorio[] = [
  { value: 'titulo', label: 'Título' },
  { value: 'setor', label: 'Setor' },
  { value: 'status', label: 'Status' },
  { value: 'prioridade', label: 'Prioridade' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'motivo_solicitacao', label: 'Motivo' },
  { value: 'quantidade_vagas', label: 'Quantidade' },
  { value: 'salario', label: 'Salário' },
  { value: 'data_inicio_prevista', label: 'Início previsto' },
  { value: 'data_alvo_preenchimento', label: 'Prazo p/ preencher' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'criado_por', label: 'Criado por' },
  { value: 'total_candidatos', label: 'Total de candidatos' },
  { value: 'created_at', label: 'Criada em' },
]

export const CAMPOS_CANDIDATO: CampoRelatorio[] = [
  { value: 'nome', label: 'Nome' },
  { value: 'email', label: 'Email' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'cpf', label: 'CPF' },
  { value: 'vaga', label: 'Vaga' },
  { value: 'vaga_setor', label: 'Setor da vaga' },
  { value: 'etapa_atual', label: 'Etapa' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'cadastrado_por', label: 'Cadastrado por' },
  { value: 'created_at', label: 'Cadastrado em' },
]
