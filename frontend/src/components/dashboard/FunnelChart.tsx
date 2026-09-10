import type { FunilEtapa } from '../../api/dashboard'
import { HorizontalBarChart } from './charts/HorizontalBarChart'
import { chart } from './charts/chartTheme'

interface FunnelChartProps {
  etapas: FunilEtapa[]
}

/** Funil do pipeline de pessoas por etapa (ordenado); etapa de saída negativa em vermelho. */
export function FunnelChart({ etapas }: FunnelChartProps) {
  return (
    <HorizontalBarChart
      emptyMessage="Ninguém no funil ainda."
      data={[...etapas]
        .sort((a, b) => a.ordem - b.ordem)
        .map((etapa) => ({
          label: etapa.nome,
          value: etapa.total,
          color: etapa.is_saida_negativa ? chart.critical : chart.series1,
        }))}
    />
  )
}
