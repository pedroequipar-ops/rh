import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { VagaSeriePonto } from '../../../api/dashboard'
import { axisTick, chart, legendProps, tooltipProps } from './chartTheme'

function rotuloSemana(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Vagas por semana: colunas = criadas (volume de entrada), linha = preenchidas
 *  (resultado). Mesma escala, um só eixo. */
export function WeeklySeriesChart({ pontos }: { pontos: VagaSeriePonto[] }) {
  const data = pontos.map((p) => ({ ...p, rotulo: rotuloSemana(p.semana) }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={chart.grid} vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: chart.axis }} tick={axisTick} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={48} />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        <Bar dataKey="criadas" name="Criadas" fill={chart.series1} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="preenchidas"
          name="Preenchidas"
          stroke={chart.series2}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
