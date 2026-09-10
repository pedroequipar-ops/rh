import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, X } from 'lucide-react'
import { gerarRelatorio, type RelatorioGrupoLinha, type RelatorioInput } from '../api/relatorios'
import { useEtapas } from '../api/hooks/useEtapas'
import { useSetores } from '../api/hooks/useSetores'
import { useToast } from '../context/ToastContext'
import { BuscarButton } from '../components/board/BuscarButton'
import { Button, Card, Field, Input, Select } from '../components/ui'
import { baixarRelatorioPdf, type SecaoPdf } from '../lib/relatorioPdf'
import {
  FILTROS_CANDIDATO_VAZIO,
  FILTROS_VAGA_VAZIO,
  type FiltrosCandidato,
  type FiltrosVaga,
} from '../lib/filtros'
import { CAMPOS_CANDIDATO, CAMPOS_VAGA, type CampoRelatorio } from '../constants/camposRelatorio'
import { MOTIVO_SOLICITACAO_OPCOES, VAGA_STATUS_META, statusLabel } from '../constants/vagaStatus'
import type { VagaStatus } from '../types'

type Entidade = 'vaga' | 'candidato'
type Aba = Entidade | 'completo'
type Opcao = { value: string; label: string }
type Distribuicao = { label: string; value: number }

const ABA_LABEL: Record<Aba, string> = { vaga: 'Vagas', candidato: 'Candidatos', completo: 'Completo' }

/** Campos que rendem uma distribuição (contagem por valor) num gráfico. */
const CAMPOS_CATEGORICOS: Record<Entidade, string[]> = {
  vaga: ['status', 'setor', 'prioridade', 'motivo_solicitacao', 'urgente', 'atrasada', 'responsavel', 'criado_por'],
  candidato: ['etapa_atual', 'vaga_setor', 'vaga', 'responsavel', 'cadastrado_por'],
}

/** Campos numéricos que viram card de soma. */
const CAMPOS_SOMA: Record<string, string> = {
  quantidade_vagas: 'Posições em aberto',
  total_candidatos: 'Total de candidatos',
}

function distribuir(linhas: Record<string, string>[], campo: string, limite = 10): Distribuicao[] {
  const cont = new Map<string, number>()
  for (const l of linhas) {
    const chave = (l[campo] ?? '').trim() || '—'
    cont.set(chave, (cont.get(chave) ?? 0) + 1)
  }
  const ord = [...cont.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))
  if (ord.length <= limite) return ord
  const resto = ord.slice(limite).reduce((s, d) => s + d.value, 0)
  return [...ord.slice(0, limite), { label: 'Outros', value: resto }]
}

function somar(linhas: Record<string, string>[], campo: string): number {
  return linhas.reduce((s, l) => {
    const n = Number.parseFloat((l[campo] ?? '').replace(',', '.'))
    return s + (Number.isFinite(n) ? n : 0)
  }, 0)
}

function contar(linhas: Record<string, string>[], campo: string, valor: string): number {
  return linhas.filter((l) => (l[campo] ?? '') === valor).length
}

const labelCampo = (ent: Entidade, valor: string) =>
  (ent === 'vaga' ? CAMPOS_VAGA : CAMPOS_CANDIDATO).find((c) => c.value === valor)?.label ?? valor

/** Transforma o resultado cru da API (linhas ou grupos) numa seção do PDF —
 * métricas + distribuições. Devolve null se não veio nada. */
function computarSecao(
  ent: Entidade,
  campos: string[],
  resultado: Record<string, string>[] | RelatorioGrupoLinha[],
  agrupamento: string,
): SecaoPdf | null {
  const tituloSecao = ent === 'vaga' ? 'Vagas' : 'Candidatos'

  if (agrupamento) {
    const grupos = resultado as RelatorioGrupoLinha[]
    if (grupos.length === 0) return null
    const total = grupos.reduce((s, g) => s + g.total, 0)
    return {
      titulo: tituloSecao,
      metricas: [
        { label: 'Registros', valor: String(total) },
        { label: `Grupos por ${labelCampo(ent, agrupamento)}`, valor: String(grupos.length) },
      ],
      distribuicoes: [
        {
          titulo: `Por ${labelCampo(ent, agrupamento)}`,
          itens: [...grupos]
            .map((g) => ({ label: g.grupo, value: g.total }))
            .sort((a, b) => b.value - a.value),
        },
      ],
    }
  }

  const linhas = resultado as Record<string, string>[]
  if (linhas.length === 0) return null

  const metricas = [{ label: 'Registros', valor: String(linhas.length) }]
  if (ent === 'vaga' && campos.includes('urgente')) {
    metricas.push({ label: 'Urgentes', valor: String(contar(linhas, 'urgente', 'Sim')) })
  }
  if (ent === 'vaga' && campos.includes('atrasada')) {
    metricas.push({ label: 'Atrasadas', valor: String(contar(linhas, 'atrasada', 'Sim')) })
  }
  for (const c of campos) {
    if (c in CAMPOS_SOMA) {
      metricas.push({ label: CAMPOS_SOMA[c], valor: somar(linhas, c).toLocaleString('pt-BR') })
    }
  }

  const distribuicoes = CAMPOS_CATEGORICOS[ent]
    .filter((c) => campos.includes(c) && !['urgente', 'atrasada'].includes(c))
    .map((c) => ({ titulo: `Por ${labelCampo(ent, c)}`, itens: distribuir(linhas, c) }))
    .filter((d) => d.itens.length > 1)

  return { titulo: tituloSecao, metricas, distribuicoes }
}

function Secao({ titulo, aside, children }: { titulo: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Checks({
  opcoes,
  selecionados,
  onToggle,
  colunas = 3,
}: {
  opcoes: Opcao[]
  selecionados: string[]
  onToggle: (value: string) => void
  colunas?: 2 | 3
}) {
  if (opcoes.length === 0) {
    return <p className="text-xs text-slate-400">Nada disponível.</p>
  }
  return (
    <div
      className={
        colunas === 2
          ? 'grid grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2'
          : 'grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3'
      }
    >
      {opcoes.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={selecionados.includes(o.value)}
            onChange={() => onToggle(o.value)}
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function ChipButton({
  children,
  onClick,
  tone = 'neutral',
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'neutral' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === 'danger'
          ? 'inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium text-blue-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
      }
    >
      {children}
    </button>
  )
}

function SubFiltro({
  label,
  children,
  opcoes,
  selecionados,
  onSetTodos,
}: {
  label: string
  children: ReactNode
  opcoes?: Opcao[]
  selecionados?: string[]
  onSetTodos?: (valores: string[]) => void
}) {
  const todos = !!opcoes && !!selecionados && opcoes.length > 0 && selecionados.length === opcoes.length
  return (
    <div>
      <div className="mb-1 flex min-h-[18px] items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        {onSetTodos && opcoes && opcoes.length > 0 && (
          <ChipButton
            tone={todos ? 'danger' : 'neutral'}
            onClick={() => onSetTodos(todos ? [] : opcoes.map((o) => o.value))}
          >
            {todos ? (
              <>
                <X size={11} /> Limpar
              </>
            ) : (
              'Marcar todas'
            )}
          </ChipButton>
        )}
      </div>
      {children}
    </div>
  )
}

const STATUS_OPCOES: Opcao[] = (Object.keys(VAGA_STATUS_META) as VagaStatus[]).map((s) => ({
  value: s,
  label: statusLabel(s),
}))
const MOTIVO_OPCOES: Opcao[] = MOTIVO_SOLICITACAO_OPCOES.filter((o) => o.value)

export function RelatorioBuilder() {
  const { showToast } = useToast()
  const etapasQuery = useEtapas()
  const setoresQuery = useSetores()

  const [aba, setAba] = useState<Aba>('vaga')
  const [camposVaga, setCamposVaga] = useState<string[]>(CAMPOS_VAGA.map((c) => c.value))
  const [camposCandidato, setCamposCandidato] = useState<string[]>(
    CAMPOS_CANDIDATO.map((c) => c.value),
  )
  const [filtrosVaga, setFiltrosVaga] = useState<FiltrosVaga>(FILTROS_VAGA_VAZIO)
  const [filtrosCandidato, setFiltrosCandidato] = useState<FiltrosCandidato>(FILTROS_CANDIDATO_VAZIO)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [agrupamento, setAgrupamento] = useState('')
  const [carregando, setCarregando] = useState(false)

  // no modo "completo" o formulário some; a entidade só serve pra montar o form
  const entidade: Entidade = aba === 'completo' ? 'vaga' : aba
  const camposDisponiveis: CampoRelatorio[] = entidade === 'vaga' ? CAMPOS_VAGA : CAMPOS_CANDIDATO
  const campos = entidade === 'vaga' ? camposVaga : camposCandidato
  const setCampos = entidade === 'vaga' ? setCamposVaga : setCamposCandidato

  const setorOpcoes: Opcao[] = (setoresQuery.data ?? []).map((s) => ({ value: s.id, label: s.nome }))
  const etapaOpcoes: Opcao[] = (etapasQuery.data ?? []).map((e) => ({ value: e.id, label: e.nome }))

  function toggleCampo(valor: string) {
    setCampos((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]))
  }

  function toggleVaga(key: keyof Pick<FiltrosVaga, 'status' | 'setor' | 'motivo'>, valor: string) {
    setFiltrosVaga((prev) => ({
      ...prev,
      [key]: prev[key].includes(valor as never)
        ? prev[key].filter((v) => v !== valor)
        : [...prev[key], valor],
    }))
  }

  function toggleCandidato(key: 'etapa' | 'setorVaga', valor: string) {
    setFiltrosCandidato((prev) => ({
      ...prev,
      [key]: prev[key].includes(valor) ? prev[key].filter((v) => v !== valor) : [...prev[key], valor],
    }))
  }

  function montarInput(): RelatorioInput {
    const filtros: Record<string, string[] | boolean | string> = {}
    if (entidade === 'vaga') {
      if (filtrosVaga.status.length) filtros.status = filtrosVaga.status
      if (filtrosVaga.setor.length) filtros.setor = filtrosVaga.setor
      if (filtrosVaga.motivo.length) filtros.motivo = filtrosVaga.motivo
      if (filtrosVaga.urgente) filtros.urgente = true
      if (filtrosVaga.atrasada) filtros.atrasada = true
    } else {
      if (filtrosCandidato.etapa.length) filtros.etapa = filtrosCandidato.etapa
      if (filtrosCandidato.setorVaga.length) filtros.setor_vaga = filtrosCandidato.setorVaga
      if (filtrosCandidato.saidaNegativa) filtros.saida_negativa = true
    }

    return {
      entidade,
      campos,
      filtros,
      periodo: { inicio: inicio || undefined, fim: fim || undefined },
      agrupamento: agrupamento || undefined,
      modo: agrupamento ? 'agrupado' : 'detalhado',
    }
  }

  function resumoPeriodo(): string {
    const fmt = (d: string) => d.split('-').reverse().join('/')
    if (inicio && fim) return `Período de ${fmt(inicio)} a ${fmt(fim)}`
    if (inicio) return `A partir de ${fmt(inicio)}`
    if (fim) return `Até ${fmt(fim)}`
    return 'Todo o período'
  }

  async function handleGerar() {
    setCarregando(true)
    try {
      const geradoEm = `gerado em ${new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })}`
      let dados: Parameters<typeof baixarRelatorioPdf>[0]

      if (aba === 'completo') {
        const periodo = { inicio: inicio || undefined, fim: fim || undefined }
        const [rv, rc] = await Promise.all([
          gerarRelatorio({ entidade: 'vaga', campos: camposVaga, filtros: {}, periodo, modo: 'detalhado' }),
          gerarRelatorio({
            entidade: 'candidato',
            campos: camposCandidato,
            filtros: {},
            periodo,
            modo: 'detalhado',
          }),
        ])
        const secoes = [
          computarSecao('vaga', camposVaga, rv, ''),
          computarSecao('candidato', camposCandidato, rc, ''),
        ].filter((s): s is SecaoPdf => s !== null)
        if (secoes.length === 0) {
          showToast('Nenhum registro para o período selecionado', 'error')
          return
        }
        dados = {
          titulo: 'Relatório completo',
          meta: [resumoPeriodo(), geradoEm].join(' · '),
          secoes,
          nomeArquivo: 'relatorio-completo.pdf',
        }
      } else {
        const ent = aba
        const resultado = await gerarRelatorio(montarInput())
        const secao = computarSecao(ent, campos, resultado, agrupamento)
        if (!secao) {
          showToast('Nenhum registro para os filtros selecionados', 'error')
          return
        }
        dados = {
          titulo: `Relatório de ${ABA_LABEL[ent]}`,
          meta: [
            resumoPeriodo(),
            agrupamento && `agrupado por ${labelCampo(ent, agrupamento)}`,
            geradoEm,
          ]
            .filter(Boolean)
            .join(' · '),
          secoes: [{ ...secao, titulo: '' }],
          nomeArquivo: `relatorio-${ent === 'vaga' ? 'vagas' : 'candidatos'}.pdf`,
        }
      }

      await baixarRelatorioPdf(dados)
    } catch {
      showToast('Não foi possível gerar o relatório', 'error')
    } finally {
      setCarregando(false)
    }
  }

  const todosCampos = campos.length === camposDisponiveis.length

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-semibold text-slate-800">Relatório personalizado</h1>
        </div>
        <BuscarButton />
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Card className="space-y-4 p-5">
            <Secao titulo="Tipo de relatório">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {(['vaga', 'candidato', 'completo'] as Aba[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAba(a)}
                    className={
                      aba === a
                        ? 'rounded-md bg-white px-3.5 py-1 text-sm font-medium text-slate-800 shadow-sm'
                        : 'rounded-md px-3.5 py-1 text-sm text-slate-500 transition-colors hover:text-slate-700'
                    }
                  >
                    {ABA_LABEL[a]}
                  </button>
                ))}
              </div>
              {aba === 'completo' && (
                <p className="mt-2 text-xs text-slate-400">
                  Junta Vagas e Candidatos num PDF só, cada um em sua seção. Usa as colunas de cada
                  aba e o período abaixo.
                </p>
              )}
            </Secao>

            {aba !== 'completo' && (
            <>
            <Secao
              titulo="Colunas do relatório"
              aside={
                <ChipButton
                  tone={todosCampos ? 'danger' : 'neutral'}
                  onClick={() => setCampos(todosCampos ? [] : camposDisponiveis.map((c) => c.value))}
                >
                  {todosCampos ? (
                    <>
                      <X size={11} /> Limpar
                    </>
                  ) : (
                    'Marcar todas'
                  )}
                </ChipButton>
              }
            >
              <Checks opcoes={camposDisponiveis} selecionados={campos} onToggle={toggleCampo} />
            </Secao>

            <Secao titulo="Filtros">
              {entidade === 'vaga' ? (
                <div className="space-y-3">
                  <SubFiltro
                    label="Status"
                    opcoes={STATUS_OPCOES}
                    selecionados={filtrosVaga.status}
                    onSetTodos={(v) => setFiltrosVaga((p) => ({ ...p, status: v as VagaStatus[] }))}
                  >
                    <Checks
                      opcoes={STATUS_OPCOES}
                      selecionados={filtrosVaga.status}
                      onToggle={(v) => toggleVaga('status', v)}
                    />
                  </SubFiltro>
                  <SubFiltro
                    label="Setor"
                    opcoes={setorOpcoes}
                    selecionados={filtrosVaga.setor}
                    onSetTodos={(v) => setFiltrosVaga((p) => ({ ...p, setor: v }))}
                  >
                    <Checks
                      opcoes={setorOpcoes}
                      selecionados={filtrosVaga.setor}
                      onToggle={(v) => toggleVaga('setor', v)}
                    />
                  </SubFiltro>
                  <SubFiltro
                    label="Motivo da solicitação"
                    opcoes={MOTIVO_OPCOES}
                    selecionados={filtrosVaga.motivo}
                    onSetTodos={(v) => setFiltrosVaga((p) => ({ ...p, motivo: v }))}
                  >
                    <Checks
                      opcoes={MOTIVO_OPCOES}
                      selecionados={filtrosVaga.motivo}
                      onToggle={(v) => toggleVaga('motivo', v)}
                      colunas={2}
                    />
                  </SubFiltro>
                  <SubFiltro label="Sinalizadores">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={filtrosVaga.urgente}
                          onChange={(e) =>
                            setFiltrosVaga((p) => ({ ...p, urgente: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Só urgentes
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={filtrosVaga.atrasada}
                          onChange={(e) =>
                            setFiltrosVaga((p) => ({ ...p, atrasada: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Só atrasadas
                      </label>
                    </div>
                  </SubFiltro>
                </div>
              ) : (
                <div className="space-y-3">
                  <SubFiltro
                    label="Etapa"
                    opcoes={etapaOpcoes}
                    selecionados={filtrosCandidato.etapa}
                    onSetTodos={(v) => setFiltrosCandidato((p) => ({ ...p, etapa: v }))}
                  >
                    <Checks
                      opcoes={etapaOpcoes}
                      selecionados={filtrosCandidato.etapa}
                      onToggle={(v) => toggleCandidato('etapa', v)}
                    />
                  </SubFiltro>
                  <SubFiltro label="Sinalizadores">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={filtrosCandidato.saidaNegativa}
                        onChange={(e) =>
                          setFiltrosCandidato((p) => ({ ...p, saidaNegativa: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Só em etapa de saída
                    </label>
                  </SubFiltro>
                </div>
              )}
            </Secao>
            </>
            )}

            <Secao titulo={aba === 'completo' ? 'Período' : 'Período e agrupamento'}>
              <div className={aba === 'completo' ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-3'}>
                <Field label="De" htmlFor="rel-inicio">
                  <Input
                    id="rel-inicio"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </Field>
                <Field label="Até" htmlFor="rel-fim">
                  <Input
                    id="rel-fim"
                    type="date"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                  />
                </Field>
                {aba !== 'completo' && (
                  <Field label="Agrupar por" htmlFor="rel-agrup">
                    <Select
                      id="rel-agrup"
                      value={agrupamento}
                      onChange={(e) => setAgrupamento(e.target.value)}
                    >
                      <option value="">Sem agrupamento</option>
                      {camposDisponiveis.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            </Secao>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={handleGerar} disabled={carregando}>
                <FileText size={14} /> {carregando ? 'Gerando...' : 'Gerar relatório em PDF'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
