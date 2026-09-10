import { Bar, BarChart, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CandidaturaVsCadastrado } from '../../../api/dashboard'
import { axisTick, chart, legendProps, tooltipProps } from './chartTheme'

/** Candidaturas informadas x pessoas de fato cadastradas, por vaga — colunas
 *  agrupadas, 2 séries. */
export function CandidaturasChart({ itens }: { itens: CandidaturaVsCadastrado[] }) {
  if (itens.length === 0) return <p className="text-sm text-slate-400">Nenhuma vaga publicada.</p>

  const data = itens.map((i) => ({
    label: i.titulo,
    Informadas: i.candidaturas,
    Cadastradas: i.cadastrados,
  }))

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: -16 }} barGap={4} barCategoryGap="30%">
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: chart.axis }} tick={axisTick} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={40} />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        <Bar dataKey="Informadas" fill={chart.series1} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          <LabelList dataKey="Informadas" position="top" fill={chart.inkSecondary} fontSize={11} />
        </Bar>
        <Bar dataKey="Cadastradas" fill={chart.series2} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          <LabelList dataKey="Cadastradas" position="top" fill={chart.inkSecondary} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
