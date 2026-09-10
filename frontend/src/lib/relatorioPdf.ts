import type { jsPDF } from 'jspdf'

export interface DistribuicaoPdf {
  titulo: string
  itens: { label: string; value: number }[]
}

export interface SecaoPdf {
  /** rótulo da seção (ex.: "Vagas"); vazio quando o relatório tem uma só */
  titulo: string
  metricas: { label: string; valor: string }[]
  distribuicoes: DistribuicaoPdf[]
}

export interface RelatorioPdfDados {
  titulo: string
  meta: string
  secoes: SecaoPdf[]
  nomeArquivo: string
}

const PAG_L = 210
const PAG_A = 297
const MARGEM = 14
const COL_GAP = 8
const AZUL: [number, number, number] = [42, 120, 214]
const TRILHO: [number, number, number] = [230, 238, 251]
const LARGURA_UTIL = PAG_L - MARGEM * 2
const COL_LARGURA = (LARGURA_UTIL - COL_GAP) / 2
const PAD = 4

function corta(doc: jsPDF, texto: string, larguraMm: number): string {
  if (doc.getTextWidth(texto) <= larguraMm) return texto
  let t = texto
  while (t.length > 1 && doc.getTextWidth(t + '…') > larguraMm) t = t.slice(0, -1)
  return t + '…'
}

const alturaBloco = (dist: DistribuicaoPdf) => PAD * 2 + 6 + dist.itens.length * 5.4

/** Faixa de cartões de métrica (4 por linha, largura total). Devolve o Y final. */
function desenharMetricas(doc: jsPDF, metricas: SecaoPdf['metricas'], yInicial: number): number {
  if (metricas.length === 0) return yInicial
  const porLinha = 4
  const gap = 4
  const cartaoL = (LARGURA_UTIL - gap * (porLinha - 1)) / porLinha
  const cartaoA = 14
  let y = yInicial
  metricas.forEach((m, i) => {
    const col = i % porLinha
    if (col === 0 && i > 0) y += cartaoA + gap
    const x = MARGEM + col * (cartaoL + gap)
    doc.setDrawColor(224, 224, 224)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(x, y, cartaoL, cartaoA, 1.4, 1.4, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(corta(doc, m.label, cartaoL - 6), x + 3, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text(m.valor, x + 3, y + 11)
  })
  return y + cartaoA + 8
}

/** Gráficos de barras em 2 colunas, cada bloco num card cinza claro. Y final. */
function desenharGraficos(doc: jsPDF, dists: DistribuicaoPdf[], yInicial: number): number {
  const colX = [MARGEM, MARGEM + COL_LARGURA + COL_GAP]
  const colY = [yInicial, yInicial]

  for (const dist of dists) {
    const h = alturaBloco(dist)
    let col = colY[0] <= colY[1] ? 0 : 1
    if (colY[col] + h > PAG_A - MARGEM) {
      doc.addPage()
      colY[0] = MARGEM + 4
      colY[1] = MARGEM + 4
      col = 0
    }
    const x = colX[col]
    const cardY = colY[col]

    doc.setDrawColor(224, 224, 224)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(x, cardY, COL_LARGURA, h, 1.6, 1.6, 'FD')

    let by = cardY + PAD
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51)
    doc.text(dist.titulo, x + PAD, by + 3)
    by += 7

    const rotuloL = 28
    const valorL = 7
    const barX = x + PAD + rotuloL + 2
    const barMax = COL_LARGURA - PAD * 2 - rotuloL - valorL - 4
    const maior = Math.max(...dist.itens.map((it) => it.value), 1)

    doc.setFont('helvetica', 'normal')
    for (const it of dist.itens) {
      doc.setFontSize(7)
      doc.setTextColor(90)
      doc.text(corta(doc, it.label, rotuloL), x + PAD + rotuloL, by + 2.6, { align: 'right' })
      doc.setFillColor(...TRILHO)
      doc.roundedRect(barX, by, barMax, 3.2, 0.6, 0.6, 'F')
      doc.setFillColor(...AZUL)
      const w = Math.max(0.8, (it.value / maior) * barMax)
      doc.roundedRect(barX, by, w, 3.2, 0.6, 0.6, 'F')
      doc.setTextColor(60)
      doc.text(String(it.value), barX + barMax + 2, by + 2.6)
      by += 5.4
    }
    colY[col] = cardY + h + 5
  }

  return Math.max(colY[0], colY[1])
}

/** Gera o PDF do relatório (cabeçalho + uma ou mais seções, cada uma com
 * cartões de métrica e gráficos de barras) e dispara o download — sem passar
 * por janela de impressão nem renderizar nada na tela. */
export async function baixarRelatorioPdf(d: RelatorioPdfDados): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(30)
  doc.text(d.titulo, MARGEM, MARGEM + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(140)
  doc.text(d.meta, MARGEM, MARGEM + 9)

  let y = MARGEM + 15
  const varias = d.secoes.length > 1

  d.secoes.forEach((sec, i) => {
    if (varias) {
      if (i > 0 && y > PAG_A - MARGEM - 40) {
        doc.addPage()
        y = MARGEM + 4
      } else if (i > 0) {
        y += 4
      }
      doc.setDrawColor(224, 224, 224)
      doc.line(MARGEM, y, PAG_L - MARGEM, y)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30)
      doc.text(sec.titulo, MARGEM, y + 2)
      y += 8
    }
    y = desenharMetricas(doc, sec.metricas, y)
    y = desenharGraficos(doc, sec.distribuicoes, y)
  })

  doc.save(d.nomeArquivo)
}
