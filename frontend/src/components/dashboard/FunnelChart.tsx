import type { FunilEtapa } from '../../api/dashboard'
import { StatusBarList } from './StatusBarList'

interface FunnelChartProps {
  etapas: FunilEtapa[]
}

/** Funil do pipeline de pessoas por etapa (ordenado), etapa de saída em vermelho. */
export function FunnelChart({ etapas }: FunnelChartProps) {
  return (
    <StatusBarList
      emptyMessage="Ninguém no funil ainda."
      items={[...etapas]
        .sort((a, b) => a.ordem - b.ordem)
        .map((etapa) => ({
          key: etapa.etapa_id,
          label: etapa.nome,
          total: etapa.total,
          colorClass: etapa.is_saida_negativa ? 'bg-red-400' : 'bg-blue-500',
        }))}
    />
  )
}
