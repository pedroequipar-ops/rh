import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Flame, History, MessageCircle, Pencil, X } from 'lucide-react'
import clsx from 'clsx'
import { ChatPanel } from '../candidato/ChatPanel'
import {
  aprovarVaga,
  cobrarVaga,
  listSetores,
  recusarVaga,
  registrarCandidaturas,
  transicionarVaga,
  updateVaga,
} from '../../api/vagas'
import { useVaga, useVagaHistorico } from '../../api/hooks/useVagas'
import { queryKeys } from '../../api/queryKeys'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog } from '../common/ConfirmDialog'
import {
  MOTIVO_SOLICITACAO_OPCOES,
  PRIORIDADE_META,
  VAGA_STATUS_META,
  statusLabel,
} from '../../constants/vagaStatus'
import type { Setor, Vaga, VagaPrioridade, VagaStatus } from '../../types'

const ACAO_LABEL: Partial<Record<VagaStatus, string>> = {
  SOLICITADA: 'Enviar solicitação',
  APROVADA: 'Aprovar',
  PUBLICADA: 'Publicar',
  ENCERRADA: 'Encerrar candidaturas',
  EM_TRIAGEM: 'Iniciar triagem',
  CONGELADA: 'Congelar',
  CANCELADA: 'Cancelar vaga',
  PREENCHIDA: 'Marcar preenchida',
  RECUSADA: 'Recusar',
}

const QTD_FASE_LABEL: Partial<Record<VagaStatus, string>> = {
  EM_TRIAGEM: 'Pessoas nesta fase',
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dataVencida(iso: string | null): boolean {
  if (!iso) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return new Date(iso) < hoje
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CandidaturasRecebidas({
  vaga,
  isRh,
  onRegistrado,
}: {
  vaga: Vaga
  isRh: boolean
  onRegistrado: (v: Vaga) => void
}) {
  const { showToast } = useToast()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(vaga.qtd_pessoas_fase))
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const n = Number(valor)
    if (!Number.isFinite(n) || n < 0 || n === vaga.qtd_pessoas_fase) {
      setEditando(false)
      return
    }
    setSalvando(true)
    try {
      onRegistrado(await registrarCandidaturas(vaga.id, n))
      showToast('Candidaturas registradas no histórico')
      setEditando(false)
    } catch {
      showToast('Não foi possível registrar', 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (!isRh) {
    return <span>Candidaturas recebidas: {vaga.qtd_pessoas_fase}</span>
  }

  if (!editando) {
    return (
      <span className="inline-flex items-center gap-1">
        Candidaturas recebidas: {vaga.qtd_pessoas_fase}
        <button
          onClick={() => {
            setValor(String(vaga.qtd_pessoas_fase))
            setEditando(true)
          }}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Editar candidaturas recebidas"
        >
          <Pencil size={12} />
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      Candidaturas recebidas:
      <input
        type="number"
        min={0}
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar()
          if (e.key === 'Escape') setEditando(false)
        }}
        className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button
        onClick={salvar}
        disabled={salvando}
        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
        aria-label="Salvar"
      >
        <Check size={14} />
      </button>
      <button
        onClick={() => setEditando(false)}
        className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
        aria-label="Cancelar"
      >
        <X size={14} />
      </button>
    </span>
  )
}

export function VagaDetalheModal() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <VagaDetalheModalInner key={id} id={id} />
}

function VagaDetalheModalInner({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { me } = useAuth()
  const { showToast } = useToast()
  const isRh = me?.role === 'RH'

  const { data: vaga, isError: error } = useVaga(id)
  const { data: historico = [] } = useVagaHistorico(id)
  const [editando, setEditando] = useState(false)
  const [setores, setSetores] = useState<Setor[]>([])
  const [acaoPendente, setAcaoPendente] = useState<'aprovar' | 'recusar' | null>(null)
  const [confirmar, setConfirmar] = useState<VagaStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [mostrarChat, setMostrarChat] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // form de edição
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [quantidadeVagas, setQuantidadeVagas] = useState(1)
  const [salario, setSalario] = useState('')
  const [setorId, setSetorId] = useState('')
  const [prioridade, setPrioridade] = useState<VagaPrioridade>(2)
  const [urgente, setUrgente] = useState(false)
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataAlvo, setDataAlvo] = useState('')
  const [qtdPessoasFase, setQtdPessoasFase] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  // form aprovar / recusar
  const [motivoRecusa, setMotivoRecusa] = useState('')

  function abrirAprovar() {
    if (!vaga) return
    setPrioridade(vaga.prioridade)
    setUrgente(vaga.urgente)
    setDataAlvo(vaga.data_alvo_preenchimento ?? '')
    setAcaoPendente('aprovar')
  }

  const recarregar = useCallback(
    (atualizada: Vaga) => {
      qc.setQueryData(queryKeys.vaga(atualizada.id), atualizada)
      qc.setQueryData<Vaga[]>(queryKeys.vagasList, (old) =>
        old?.map((v) => (v.id === atualizada.id ? atualizada : v)),
      )
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(atualizada.id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.candidatos })
    },
    [qc],
  )

  function iniciarEdicao() {
    if (!vaga) return
    setTitulo(vaga.titulo)
    setDescricao(vaga.descricao)
    setRequisitos(vaga.requisitos)
    setQuantidadeVagas(vaga.quantidade_vagas)
    setSalario(vaga.salario != null ? String(vaga.salario) : '')
    setSetorId(vaga.setor.id)
    setPrioridade(vaga.prioridade)
    setUrgente(vaga.urgente)
    setMotivoSolicitacao(vaga.motivo_solicitacao)
    setDataInicio(vaga.data_inicio_prevista ?? '')
    setDataAlvo(vaga.data_alvo_preenchimento ?? '')
    setQtdPessoasFase(vaga.qtd_pessoas_fase)
    setErroSalvar(null)
    if (isRh && setores.length === 0) {
      listSetores().then(setSetores).catch(() => setSetores([]))
    }
    setEditando(true)
  }

  useEffect(() => {
    if (!vaga) return
    const params = new URLSearchParams(location.search)
    if (params.get('editar') === '1') iniciarEdicao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaga])

  useEffect(() => {
    if (mostrarChat) {
      chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [mostrarChat])

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setErroSalvar(null)
    setSubmitting(true)
    try {
      const atualizada = await updateVaga(id, {
        titulo,
        descricao,
        requisitos,
        quantidade_vagas: quantidadeVagas,
        salario: salario || null,
        prioridade,
        urgente,
        motivo_solicitacao: motivoSolicitacao,
        data_inicio_prevista: dataInicio || null,
        data_alvo_preenchimento: dataAlvo || null,
        ...(vaga && QTD_FASE_LABEL[vaga.status] ? { qtd_pessoas_fase: qtdPessoasFase } : {}),
        ...(isRh ? { setor_id: setorId } : {}),
      })
      recarregar(atualizada)
      setEditando(false)
      showToast('Vaga salva com sucesso')
    } catch {
      setErroSalvar('Não foi possível salvar. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function executarTransicao(destino: VagaStatus) {
    if (!id) return
    setBusy(true)
    try {
      const atualizada = await transicionarVaga(id, destino)
      recarregar(atualizada)
      showToast(`Vaga movida para "${statusLabel(destino)}"`)
    } catch {
      showToast('Não foi possível mudar a etapa da vaga', 'error')
    } finally {
      setBusy(false)
      setConfirmar(null)
    }
  }

  async function handleAprovar(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setBusy(true)
    try {
      const atualizada = await aprovarVaga(id, {
        prioridade,
        urgente,
        data_alvo_preenchimento: dataAlvo || null,
      })
      recarregar(atualizada)
      setAcaoPendente(null)
      showToast('Vaga aprovada')
    } catch {
      showToast('Não foi possível aprovar', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecusar(event: FormEvent) {
    event.preventDefault()
    if (!id || !motivoRecusa.trim()) return
    setBusy(true)
    try {
      const atualizada = await recusarVaga(id, motivoRecusa.trim())
      recarregar(atualizada)
      setAcaoPendente(null)
      setMotivoRecusa('')
      showToast('Vaga recusada')
    } catch {
      showToast('Não foi possível recusar', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCobrar() {
    if (!id) return
    const msg = window.prompt('Mensagem da cobrança (opcional):') ?? undefined
    if (msg === undefined) return
    setBusy(true)
    try {
      const n = await cobrarVaga(id, msg || undefined)
      showToast(`Cobrança enviada para ${n} pessoa(s)`)
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(id) })
    } catch {
      showToast('Não foi possível cobrar (você pode ser o responsável desta etapa)', 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    const base = location.pathname.replace(/\/vaga\/.*$/, '')
    navigate(base)
  }

  const statusMeta = vaga ? VAGA_STATUS_META[vaga.status] : null
  const acoes = vaga
    ? vaga.transicoes_disponiveis.filter((s) => s !== 'APROVADA' && s !== 'RECUSADA')
    : []
  const podeAprovar = vaga?.transicoes_disponiveis.includes('APROVADA') && isRh
  const podeRecusar = vaga?.transicoes_disponiveis.includes('RECUSADA') && isRh

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={handleClose}
    >
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow-md hover:text-slate-800"
        >
          <X size={18} />
        </button>

        <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-white p-6 shadow-2xl">
          {error && <p className="text-sm text-red-500">Não foi possível carregar esta vaga.</p>}
          {!error && !vaga && <p className="text-sm text-slate-400">Carregando...</p>}

          {!error && vaga && !editando && (
            <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[1fr_260px]">
              {/* coluna principal (rola) */}
              <div className="scrollbar-thin min-h-0 space-y-5 overflow-y-auto pr-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-800">{vaga.titulo}</h2>
                    <p className="text-sm text-slate-500">
                      Setor: {vaga.setor.nome} · Criada por {vaga.criado_por ?? '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={clsx(
                          'rounded border px-2 py-0.5 text-xs font-medium',
                          statusMeta?.badge,
                        )}
                      >
                        {statusMeta?.label}
                      </span>
                      {vaga.urgente && (
                        <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <Flame size={12} /> Urgente
                        </span>
                      )}
                      <span
                        className={clsx(
                          'rounded border px-2 py-0.5 text-xs font-medium',
                          PRIORIDADE_META[vaga.prioridade].badge,
                        )}
                      >
                        Prioridade {PRIORIDADE_META[vaga.prioridade].label}
                      </span>
                      {vaga.atrasada && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Atrasada
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={iniciarEdicao}
                    className="flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  <span>{vaga.quantidade_vagas} vaga(s)</span>
                  <span>{vaga.salario ? `R$ ${vaga.salario}` : 'Salário não informado'}</span>
                  <span
                    className={clsx(
                      vaga.atrasada && dataVencida(vaga.data_inicio_prevista) && 'font-medium text-amber-700',
                    )}
                  >
                    Início previsto: {fmtData(vaga.data_inicio_prevista)}
                  </span>
                  <span
                    className={clsx(
                      vaga.atrasada && dataVencida(vaga.data_alvo_preenchimento) && 'font-medium text-amber-700',
                    )}
                  >
                    Prazo p/ preencher: {fmtData(vaga.data_alvo_preenchimento)}
                  </span>
                  {vaga.status === 'EM_TRIAGEM' && (
                    <span>
                      {vaga.etapa_atual?.nome ?? 'Triagem'}: {vaga.qtd_pessoas_fase} pessoa(s)
                    </span>
                  )}
                  {vaga.status === 'PUBLICADA' && (
                    <CandidaturasRecebidas
                      key={vaga.qtd_pessoas_fase}
                      vaga={vaga}
                      isRh={isRh}
                      onRegistrado={recarregar}
                    />
                  )}
                </div>

                {vaga.status === 'RECUSADA' && vaga.motivo_recusa && (
                  <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    Motivo da recusa: {vaga.motivo_recusa}
                  </p>
                )}

                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Descrição
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {vaga.descricao || 'Sem descrição.'}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Requisitos
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {vaga.requisitos || 'Sem requisitos informados.'}
                  </p>
                </div>

                {vaga.total_candidatos > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Candidatos ({vaga.total_candidatos})
                    </h3>
                    <div className="space-y-1">
                      {(vaga.total_por_etapa ?? []).map((e) => (
                        <div key={e.etapa_id} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-40 shrink-0 truncate">{e.nome}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                            <div
                              className="h-full rounded bg-slate-400"
                              style={{ width: `${(e.total / vaga.total_candidatos) * 100}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right">{e.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <History size={12} /> Histórico
                  </h3>
                  <ol className="space-y-1.5 border-l border-slate-200 pl-3 text-xs text-slate-600">
                    {historico.map((h) => (
                      <li key={h.id}>
                        <span className="font-medium text-slate-700">
                          {h.de_status ? `${statusLabel(h.de_status as VagaStatus)} → ` : ''}
                          {statusLabel(h.para_status as VagaStatus)}
                        </span>{' '}
                        · {h.por ?? 'sistema'} · {fmtDataHora(h.created_at)}
                        {h.observacao && <span className="text-slate-400"> — {h.observacao}</span>}
                      </li>
                    ))}
                    {historico.length === 0 && <li className="text-slate-400">Sem histórico.</li>}
                  </ol>
                </div>
              </div>

              {/* painel de ações (fixo) */}
              <div className="scrollbar-thin min-h-0 space-y-3 overflow-y-auto">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ações</h3>

                {acaoPendente === 'aprovar' ? (
                  <form onSubmit={handleAprovar} className="space-y-2">
                    <select
                      value={prioridade}
                      onChange={(e) => setPrioridade(Number(e.target.value) as VagaPrioridade)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value={1}>Prioridade baixa</option>
                      <option value={2}>Prioridade média</option>
                      <option value={3}>Prioridade alta</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={urgente}
                        onChange={(e) => setUrgente(e.target.checked)}
                      />
                      Urgente
                    </label>
                    <input
                      type="date"
                      value={dataAlvo}
                      onChange={(e) => setDataAlvo(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 rounded bg-sky-700 px-2 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setAcaoPendente(null)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : acaoPendente === 'recusar' ? (
                  <form onSubmit={handleRecusar} className="space-y-2">
                    <textarea
                      required
                      rows={3}
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      placeholder="Motivo da recusa"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 rounded bg-red-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => setAcaoPendente(null)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1.5">
                    {podeAprovar && (
                      <button
                        onClick={abrirAprovar}
                        className="w-full rounded bg-sky-700 px-2 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
                      >
                        Aprovar
                      </button>
                    )}
                    {podeRecusar && (
                      <button
                        onClick={() => setAcaoPendente('recusar')}
                        className="w-full rounded border border-red-300 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Recusar
                      </button>
                    )}
                    {acoes.map((destino) => {
                      const label =
                        vaga.status === 'CONGELADA' && destino === vaga.status_pre_congelamento
                          ? 'Descongelar'
                          : ACAO_LABEL[destino] ?? statusLabel(destino)
                      const perigo = destino === 'CANCELADA'
                      return (
                        <button
                          key={destino}
                          disabled={busy}
                          onClick={() =>
                            perigo ? setConfirmar(destino) : executarTransicao(destino)
                          }
                          className={clsx(
                            'w-full rounded px-2 py-1.5 text-sm font-medium disabled:opacity-50',
                            perigo
                              ? 'border border-red-300 text-red-700 hover:bg-red-50'
                              : 'border border-slate-300 text-slate-700 hover:bg-white',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <button
                      onClick={handleCobrar}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                    >
                      <Bell size={13} /> Cobrar responsável
                    </button>
                    {acoes.length === 0 && !podeAprovar && !podeRecusar && (
                      <p className="text-xs text-slate-400">Sem transições disponíveis.</p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setMostrarChat((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MessageCircle size={13} /> Chat com o setor
              </button>
              {mostrarChat && (
                <div
                  ref={chatRef}
                  className="h-80 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <ChatPanel kind="vaga" id={vaga.id} />
                </div>
              )}
              </div>
            </div>
          )}

          {!error && vaga && editando && (
            <form
              onSubmit={handleSalvar}
              className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-2"
            >
              <h2 className="text-lg font-semibold text-slate-800">Editar vaga</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Título</label>
                <input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Descrição</label>
                <textarea
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="min-h-[6rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Requisitos</label>
                <textarea
                  rows={3}
                  value={requisitos}
                  onChange={(e) => setRequisitos(e.target.value)}
                  className="min-h-[6rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Quantidade de vagas
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantidadeVagas}
                    onChange={(e) => setQuantidadeVagas(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">Salário</label>
                  <input
                    value={salario}
                    onChange={(e) => setSalario(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(Number(e.target.value) as VagaPrioridade)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    <option value={1}>Baixa</option>
                    <option value={2}>Média</option>
                    <option value={3}>Alta</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">Motivo</label>
                  <select
                    value={motivoSolicitacao}
                    onChange={(e) => setMotivoSolicitacao(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    {MOTIVO_SOLICITACAO_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={urgente}
                    onChange={(e) => setUrgente(e.target.checked)}
                  />
                  Urgente
                </label>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Início previsto
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Prazo p/ preencher
                  </label>
                  <input
                    type="date"
                    value={dataAlvo}
                    onChange={(e) => setDataAlvo(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {QTD_FASE_LABEL[vaga.status] && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    {QTD_FASE_LABEL[vaga.status]}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={qtdPessoasFase}
                    onChange={(e) => setQtdPessoasFase(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
              )}

              {isRh && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Setor solicitante
                  </label>
                  <select
                    required
                    value={setorId}
                    onChange={(e) => setSetorId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>
                        {setor.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {erroSalvar && <p className="text-sm text-red-600">{erroSalvar}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {confirmar && (
        <ConfirmDialog
          title={ACAO_LABEL[confirmar] ?? statusLabel(confirmar)}
          description={`Confirmar mudança da vaga para "${statusLabel(confirmar)}"?`}
          confirmLabel="Confirmar"
          onConfirm={() => executarTransicao(confirmar)}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}
