/** Paleta e tokens únicos pros gráficos do dashboard (modo claro só, batendo
 *  com o resto do app). Marcas usam a cor da série; textos usam tokens de tinta. */
export const chart = {
  series1: '#2a78d6', // azul — slot categórico 1 / sequencial padrão
  series2: '#eb6834', // laranja — slot categórico 2 / 2º sequencial
  critical: '#d03b3b', // vermelho de estado (etapa de saída negativa, cobranças)
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
  track: '#e6eefb', // trilho claro do medidor (azul bem lavado)
} as const

/** Ordem categórica fixa (paleta validada CVD) — nunca ciclar; 9º vira "Outros". */
export const categorical = [
  '#2a78d6', // azul
  '#eb6834', // laranja
  '#1baf7a', // água
  '#eda100', // amarelo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // vermelho
] as const

export const OUTROS_COLOR = '#898781'

export const axisTick = { fill: chart.muted, fontSize: 11 } as const

/** Legenda: bolinha colorida + texto em tinta neutra (cor forçada via CSS
 *  `.recharts-legend-item-text` no index.css, porque o Recharts pinta o texto
 *  com a cor da série por padrão). */
export const legendProps = {
  iconType: 'circle',
  iconSize: 9,
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
} as const

/** Estilo do balão de hover do Recharts, alinhado ao chrome dos cards. */
export const tooltipProps = {
  cursor: { fill: 'rgba(11,11,11,0.04)', stroke: chart.axis },
  contentStyle: {
    borderRadius: 8,
    border: '1px solid rgba(11,11,11,0.10)',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    fontSize: 12,
    padding: '6px 10px',
  },
  labelStyle: { color: chart.inkSecondary, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: chart.ink, padding: 0 },
} as const
