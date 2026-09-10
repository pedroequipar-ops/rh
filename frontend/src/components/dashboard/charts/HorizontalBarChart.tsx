import type { ReactNode } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisTick, chart, tooltipProps } from './chartTheme'

export interface HBarDatum {
  label: string
  value: number
  color?: string
}

interface Props {
  data: HBarDatum[]
  color?: string
  /** sufixo colado no valor (ex.: 'h') no rótulo e no tooltip */
  unidade?: string
  emptyMessage?: string
}

/** Barras horizontais — 1 série. Cor por barra opcional (`color` no dado). */
export function HorizontalBarChart({
  data,
  color = chart.series1,
  unidade = '',
  emptyMessage = 'Sem dados.',
}: Props) {
  if (data.length === 0) return <p className="text-sm text-slate-400">{emptyMessage}</p>

  const fmt = (v: ReactNode) => `${v}${unidade}`
  const height = Math.max(110, data.length * 36 + 16)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          interval={0}
        />
        <Tooltip {...tooltipProps} formatter={(v) => [fmt(v as ReactNode), 'Total']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={fmt}
            fill={chart.inkSecondary}
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
