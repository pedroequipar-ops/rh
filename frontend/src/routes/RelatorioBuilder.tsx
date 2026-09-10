import { useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { baixarRelatorioCsv, previewRelatorio, type RelatorioInput } from '../api/relatorios'
import { useEtapas } from '../api/hooks/useEtapas'
import { useSetores } from '../api/hooks/useSetores'
import { useToast } from '../context/ToastContext'
import { BuscarButton } from '../components/board/BuscarButton'
import { Card } from '../components/ui/Card'
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

function CheckboxGrupo({
  opcoes,
  selecionados,
  onToggle,
}: {
  opcoes: { value: string; label: string }[]
  selecionados: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {opcoes.map((opcao) => (
        <label key={opcao.value} className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selecionados.includes(opcao.value)}
            onChange={() => onToggle(opcao.value)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          {opcao.label}
        </label>
      ))}
    </div>
  )
}

const STATUS_OPCOES = (Object.keys(VAGA_STATUS_META) as VagaStatus[]).map((s) => ({
  value: s,
  label: statusLabel(s),
}))
const MOTIVO_OPCOES = MOTIVO_SOLICITACAO_OPCOES.filter((o) => o.value)

export function RelatorioBuilder() {
  const { showToast } = useToast()
  const etapasQuery = useEtapas()
  const setoresQuery = useSetores()

  const [entidade, setEntidade] = useState<Entidade>('vaga')
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
  const [baixando, setBaixando] = useState(false)
  const [linhas, setLinhas] = useState<Record<string, string>[] | null>(null)
  const [grupos, setGrupos] = useState<{ grupo: string; total: number }[] | null>(null)

  const camposDisponiveis: CampoRelatorio[] = entidade === 'vaga' ? CAMPOS_VAGA : CAMPOS_CANDIDATO
  const campos = entidade === 'vaga' ? camposVaga : camposCandidato
  const setCampos = entidade === 'vaga' ? setCamposVaga : setCamposCandidato

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

  async function handlePreview() {
    setCarregando(true)
    setLinhas(null)
    setGrupos(null)
    try {
      const resultado = await previewRelatorio(montarInput())
      if (agrupamento) {
        setGrupos(resultado as { grupo: string; total: number }[])
      } else {
        setLinhas(resultado as Record<string, string>[])
      }
    } catch {
      showToast('Não foi possível gerar a prévia', 'error')
    } finally {
      setCarregando(false)
    }
  }

  async function handleBaixar() {
    setBaixando(true)
    try {
      await baixarRelatorioCsv(montarInput())
    } catch {
      showToast('Não foi possível gerar o CSV', 'error')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <h1 className="text-lg font-semibold text-slate-800">Relatório personalizado</h1>
        <BuscarButton />
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-1.5">
              {(['vaga', 'candidato'] as Entidade[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEntidade(e)}
                  className={
                    entidade === e
                      ? 'rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white'
                      : 'rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50'
                  }
                >
                  {e === 'vaga' ? 'Vagas' : 'Candidatos'}
                </button>
              ))}
            </div>

            <div>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Campos
              </h2>
              <CheckboxGrupo opcoes={camposDisponiveis} selecionados={campos} onToggle={toggleCampo} />
            </div>

            <div>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Filtros
              </h2>
              {entidade === 'vaga' ? (
                <div className="space-y-2">
                  <CheckboxGrupo
                    opcoes={STATUS_OPCOES}
                    selecionados={filtrosVaga.status}
                    onToggle={(v) => toggleVaga('status', v)}
                  />
                  <CheckboxGrupo
                    opcoes={(setoresQuery.data ?? []).map((s) => ({ value: s.id, label: s.nome }))}
                    selecionados={filtrosVaga.setor}
                    onToggle={(v) => toggleVaga('setor', v)}
                  />
                  <CheckboxGrupo
                    opcoes={MOTIVO_OPCOES}
                    selecionados={filtrosVaga.motivo}
                    onToggle={(v) => toggleVaga('motivo', v)}
                  />
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={filtrosVaga.urgente}
                        onChange={(e) => setFiltrosVaga((p) => ({ ...p, urgente: e.target.checked }))}
                      />
                      Urgente
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={filtrosVaga.atrasada}
                        onChange={(e) => setFiltrosVaga((p) => ({ ...p, atrasada: e.target.checked }))}
                      />
                      Atrasada
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <CheckboxGrupo
                    opcoes={(etapasQuery.data ?? []).map((e) => ({ value: e.id, label: e.nome }))}
                    selecionados={filtrosCandidato.etapa}
                    onToggle={(v) => toggleCandidato('etapa', v)}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={filtrosCandidato.saidaNegativa}
                      onChange={(e) =>
                        setFiltrosCandidato((p) => ({ ...p, saidaNegativa: e.target.checked }))
                      }
                    />
                    Em etapa de saída
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Período de</label>
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">até</label>
                <input
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Agrupar por</label>
                <select
                  value={agrupamento}
                  onChange={(e) => setAgrupamento(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Sem agrupamento (linha a linha)</option>
                  {camposDisponiveis.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handlePreview}
                disabled={carregando}
                className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Eye size={14} /> {carregando ? 'Carregando...' : 'Visualizar'}
              </button>
              <button
                onClick={handleBaixar}
                disabled={baixando}
                className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                <Download size={14} /> {baixando ? 'Gerando...' : 'Baixar CSV'}
              </button>
            </div>
          </Card>

          {(linhas || grupos) && (
            <Card className="overflow-hidden p-0">
              <div className="scrollbar-thin max-h-96 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {grupos
                        ? [
                            <th key="grupo" className="px-4 py-2">
                              {camposDisponiveis.find((c) => c.value === agrupamento)?.label ?? 'Grupo'}
                            </th>,
                            <th key="total" className="px-4 py-2">
                              Total
                            </th>,
                          ]
                        : campos.map((c) => (
                            <th key={c} className="px-4 py-2">
                              {camposDisponiveis.find((cd) => cd.value === c)?.label ?? c}
                            </th>
                          ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grupos
                      ? grupos.map((g) => (
                          <tr key={g.grupo}>
                            <td className="px-4 py-2">{g.grupo}</td>
                            <td className="px-4 py-2">{g.total}</td>
                          </tr>
                        ))
                      : linhas?.map((linha, i) => (
                          <tr key={i}>
                            {campos.map((c) => (
                              <td key={c} className="px-4 py-2">
                                {linha[c]}
                              </td>
                            ))}
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Prévia com até 20 linhas — o CSV baixado traz o total.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
