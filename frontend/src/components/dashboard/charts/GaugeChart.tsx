import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'
import { chart } from './chartTheme'

interface Props {
  /** 0..100 */
  valor: number
  legenda?: string
}

/** Medidor de razão única (arco 0–100%), trilho = passo claro do mesmo tom. */
export function GaugeChart({ valor, legenda }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(valor)))
  const data = [{ name: 'valor', value: pct, fill: chart.series1 }]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadialBarChart data={data} innerRadius="70%" outerRadius="100%" startAngle={220} endAngle={-40}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar
          background={{ fill: chart.track }}
          dataKey="value"
          cornerRadius={8}
          isAnimationActive={false}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="central"
          fill={chart.ink}
          fontSize={30}
          fontWeight={700}
        >
          {pct}%
        </text>
        {legenda && (
          <text x="50%" y="68%" textAnchor="middle" fill={chart.muted} fontSize={12}>
            {legenda}
          </text>
        )}
      </RadialBarChart>
    </ResponsiveContainer>
  )
}
