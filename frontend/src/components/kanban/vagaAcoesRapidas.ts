import { Ban, Snowflake } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Vaga, VagaStatus } from '../../types'

export interface AcaoRapidaVaga {
  status: VagaStatus
  label: string
  icon: ComponentType<{ size?: number }>
}

/** Menu ⋮ do card no board Vagas — Recusar (Solicitada) e Congelar
 * (Aprovada/Publicada), as únicas transições de baixo volume que não têm
 * coluna própria. Recusar exige motivo (ver VagasBoard, endpoint dedicado);
 * Congelar dispara direto pelo onMoveVaga genérico. */
export function acoesRapidasVagas(vaga: Vaga): AcaoRapidaVaga[] {
  const t = vaga.transicoes_disponiveis
  const acoes: AcaoRapidaVaga[] = []
  if (t.includes('RECUSADA')) {
    acoes.push({ status: 'RECUSADA', label: 'Recusar', icon: Ban })
  }
  if (t.includes('CONGELADA')) {
    acoes.push({ status: 'CONGELADA', label: 'Congelar', icon: Snowflake })
  }
  return acoes
}
