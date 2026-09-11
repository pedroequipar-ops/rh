import { Trash2 } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Vaga, VagaStatus } from '../../types'

export interface AcaoRapidaVaga {
  status: VagaStatus
  label: string
  tone: 'avancar' | 'lixeira'
  icon: ComponentType<{ size?: number }>
}

/** Menu ⋮ do card no board Vagas — só o alvo destrutivo (Lixeira), que por
 * isso exige o segundo clique de confirmação do menu. "Avançar" (→ Em
 * Triagem) não é destrutivo, fica só no dock de arrastar (VagaAvancarDock),
 * não duplica aqui. */
export function acoesRapidasVagas(vaga: Vaga): AcaoRapidaVaga[] {
  const t = vaga.transicoes_disponiveis
  const acoes: AcaoRapidaVaga[] = []
  if (t.includes('ENCERRADA')) {
    acoes.push({ status: 'ENCERRADA', label: 'Lixeira', tone: 'lixeira', icon: Trash2 })
  } else if (t.includes('CANCELADA')) {
    acoes.push({ status: 'CANCELADA', label: 'Lixeira', tone: 'lixeira', icon: Trash2 })
  }
  return acoes
}
