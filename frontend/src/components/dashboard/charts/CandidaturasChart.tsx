import { Bar, BarChart, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CandidaturaVsCadastrado } from '../../../api/dashboard'
import { chart, legendProps, tooltipProps } from './chartTheme'

const MAX_CHARS_PER_LINE = 12
const MAX_LINES = 2

/** Quebra o rótulo em até MAX_LINES linhas por palavra; excesso vira "…" na
 *  última linha. Evita rótulo cortado no meio ou rotacionado saindo da área. */
function wrapLabel(label: string): string[] {
  const words = label.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > MAX_CHARS_PER_LINE && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES)
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].slice(0, MAX_CHARS_PER_LINE - 1)}…`
    return kept
  }
  return lines
}

function CategoryTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const lines = wrapLabel(payload.value)
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 13} textAnchor="middle" fill={chart.muted} fontSize={11}>
          {line}
        </text>
      ))}
    </g>
  )
}

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
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: -16 }} barGap={4} barCategoryGap="30%">
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tick={<CategoryTick x={0} y={0} payload={{ value: '' }} />}
          interval={0}
          height={38}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: chart.muted, fontSize: 11 }} width={40} />
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
