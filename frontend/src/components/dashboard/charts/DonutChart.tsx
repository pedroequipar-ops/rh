import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categorical, chart, legendProps, tooltipProps } from './chartTheme'

export interface DonutDatum {
  label: string
  value: number
}

interface Props {
  data: DonutDatum[]
  /** palavra do total no centro (ex.: "vagas") */
  unidade?: string
  emptyMessage?: string
}

/** Rosca part-to-whole — fatias na ordem categórica fixa, total no centro,
 *  legenda embaixo com texto em tinta neutra. */
export function DonutChart({ data, unidade = '', emptyMessage = 'Sem dados.' }: Props) {
  const limpo = data.filter((d) => d.value > 0)
  if (limpo.length === 0) return <p className="text-sm text-slate-400">{emptyMessage}</p>

  const total = limpo.reduce((acc, d) => acc + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={236}>
      <PieChart>
        <Tooltip {...tooltipProps} formatter={(v) => [`${v}`, 'Vagas']} />
        <Legend {...legendProps} verticalAlign="bottom" align="center" />
        <Pie
          data={limpo}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="46%"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
          stroke={chart.surface}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {limpo.map((_, i) => (
            <Cell key={i} fill={categorical[i % categorical.length]} />
          ))}
        </Pie>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central">
          <tspan x="50%" dy="-0.1em" fill={chart.ink} fontSize={26} fontWeight={700}>
            {total}
          </tspan>
          {unidade && (
            <tspan x="50%" dy="1.5em" fill={chart.muted} fontSize={11}>
              {unidade}
            </tspan>
          )}
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}
