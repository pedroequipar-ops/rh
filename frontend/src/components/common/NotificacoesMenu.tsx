import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Bell, Briefcase, Check, Inbox, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { tokenStorage } from '../../api/client'
import {
  getVagaNotificacoes,
  getVagaNotificacoesHistorico,
  marcarVagaNotificacaoUma,
  marcarVagaNotificacoesComoLidas,
  type VagaNotificacaoNova,
} from '../../api/vagas'
import { getNaoLidas, type NaoLidasResumo } from '../../api/chat'
import {
  getNotificacoesEtapa,
  getNotificacoesEtapaHistorico,
  marcarNotificacaoEtapaUma,
  marcarNotificacoesEtapaComoLidas,
  type CandidatoNotificacaoEtapa,
} from '../../api/candidatos'
import { notificacaoHref } from '../../lib/notificacaoHref'
import { NotificacoesSocket } from '../../ws/notificacoesSocket'
import { cn } from '../ui/cn'

const NOTIFICACOES_POLL_MS = 60000

function tempoRelativo(iso: string): string {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (segundos < 60) return 'agora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `${minutos} min atrás`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h atrás`
  const dias = Math.floor(horas / 24)
  return `${dias}d atrás`
}

type Bucket = 'hoje' | 'ontem' | 'semana' | 'antigas'
const BUCKET_LABEL: Record<Bucket, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Esta semana',
  antigas: 'Mais antigas',
}

function bucketDeTempo(iso: string): Bucket {
  const data = new Date(iso)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  const semanaAtras = new Date(hoje)
  semanaAtras.setDate(hoje.getDate() - 7)
  if (data >= hoje) return 'hoje'
  if (data >= ontem) return 'ontem'
  if (data >= semanaAtras) return 'semana'
  return 'antigas'
}

interface ItemHistorico {
  id: string
  tipo: 'candidato' | 'vaga'
  alvoId: string
  mensagem: string
  created_at: string
}

export function NotificacoesMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const [open, setOpen] = useState(false)
  const [aba, setAba] = useState<'novas' | 'historico'>('novas')
  const [resumoChat, setResumoChat] = useState<NaoLidasResumo | null>(null)
  const [notificacoesEtapa, setNotificacoesEtapa] = useState<CandidatoNotificacaoEtapa[]>([])
  const [notificacoesVaga, setNotificacoesVaga] = useState<VagaNotificacaoNova[]>([])

  const [historico, setHistorico] = useState<ItemHistorico[]>([])
  const [historicoCarregado, setHistoricoCarregado] = useState(false)
  const [historicoCarregando, setHistoricoCarregando] = useState(false)
  const paginaCandidatoRef = useRef(1)
  const paginaVagaRef = useRef(1)
  const temMaisCandidatoRef = useRef(true)
  const temMaisVagaRef = useRef(true)

  const ref = useRef<HTMLDivElement>(null)
  const socketRef = useRef<NotificacoesSocket | null>(null)

  function carregarNaoLidas() {
    getNaoLidas()
      .then(setResumoChat)
      .catch(() => {})
    getNotificacoesEtapa()
      .then(setNotificacoesEtapa)
      .catch(() => {})
    if (isRh) {
      getVagaNotificacoes()
        .then(setNotificacoesVaga)
        .catch(() => {})
    }
  }

  useEffect(() => {
    carregarNaoLidas()
    const interval = setInterval(carregarNaoLidas, NOTIFICACOES_POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRh])

  useEffect(() => {
    const token = tokenStorage.getAccess()
    const companyId = tokenStorage.getCompanyId()
    if (!token || !companyId) return

    const socket = new NotificacoesSocket({
      token,
      companyId,
      onEvento: (evento) => {
        if (evento.tipo === 'candidato') {
          getNotificacoesEtapa().then(setNotificacoesEtapa).catch(() => {})
        } else if (evento.tipo === 'vaga' && isRh) {
          getVagaNotificacoes().then(setNotificacoesVaga).catch(() => {})
        }
      },
      onStatusChange: (status) => {
        if (status === 'open') carregarNaoLidas()
      },
    })
    socket.connect()
    socketRef.current = socket

    return () => {
      socket.close()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRh])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!me) return null

  const totalChat = resumoChat?.total ?? 0
  const total = totalChat + notificacoesEtapa.length + notificacoesVaga.length

  function handleToggle() {
    setOpen((v) => !v)
  }

  function handleAbrirCandidato(candidatoId: string) {
    setOpen(false)
    navigate(notificacaoHref(me!.role, 'candidato', candidatoId))
  }

  function handleAbrirVaga(vagaId: string) {
    setOpen(false)
    navigate(notificacaoHref(me!.role, 'vaga', vagaId))
  }

  function marcarEtapaLida(id: string) {
    setNotificacoesEtapa((prev) => prev.filter((n) => n.id !== id))
    marcarNotificacaoEtapaUma(id).catch(() => {
      getNotificacoesEtapa().then(setNotificacoesEtapa).catch(() => {})
    })
  }

  function marcarVagaLida(id: string) {
    setNotificacoesVaga((prev) => prev.filter((n) => n.id !== id))
    marcarVagaNotificacaoUma(id).catch(() => {
      getVagaNotificacoes().then(setNotificacoesVaga).catch(() => {})
    })
  }

  function marcarTudoLido() {
    setNotificacoesEtapa([])
    setNotificacoesVaga([])
    marcarNotificacoesEtapaComoLidas().catch(() => {})
    if (isRh) marcarVagaNotificacoesComoLidas().catch(() => {})
  }

  function carregarHistorico() {
    if (historicoCarregando) return
    setHistoricoCarregando(true)
    const buscarCandidato = temMaisCandidatoRef.current
      ? getNotificacoesEtapaHistorico(paginaCandidatoRef.current)
      : Promise.resolve({ results: [], next: null })
    const buscarVaga =
      isRh && temMaisVagaRef.current
        ? getVagaNotificacoesHistorico(paginaVagaRef.current)
        : Promise.resolve({ results: [], next: null })

    Promise.all([buscarCandidato, buscarVaga])
      .then(([candidatoResp, vagaResp]) => {
        if (candidatoResp.results.length > 0) paginaCandidatoRef.current += 1
        if (vagaResp.results.length > 0) paginaVagaRef.current += 1
        temMaisCandidatoRef.current = Boolean(candidatoResp.next)
        temMaisVagaRef.current = Boolean(vagaResp.next)

        const novosItens: ItemHistorico[] = [
          ...candidatoResp.results.map((n) => ({
            id: n.id,
            tipo: 'candidato' as const,
            alvoId: n.candidato_id,
            mensagem: n.mensagem,
            created_at: n.created_at,
          })),
          ...vagaResp.results.map((n) => ({
            id: n.id,
            tipo: 'vaga' as const,
            alvoId: n.vaga_id,
            mensagem: n.mensagem,
            created_at: n.created_at,
          })),
        ]
        setHistorico((prev) =>
          [...prev, ...novosItens].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        )
        setHistoricoCarregado(true)
      })
      .finally(() => setHistoricoCarregando(false))
  }

  function abrirAba(novaAba: 'novas' | 'historico') {
    setAba(novaAba)
    if (novaAba === 'historico' && !historicoCarregado) carregarHistorico()
  }

  const semNotificacoesNovas =
    (!resumoChat || (resumoChat.candidatos.length === 0 && resumoChat.vagas.length === 0)) &&
    notificacoesEtapa.length === 0 &&
    notificacoesVaga.length === 0

  const historicoAgrupado: Array<[Bucket, ItemHistorico[]]> = (
    ['hoje', 'ontem', 'semana', 'antigas'] as Bucket[]
  )
    .map((b) => [b, historico.filter((item) => bucketDeTempo(item.created_at) === b)] as const)
    .filter(([, itens]) => itens.length > 0) as Array<[Bucket, ItemHistorico[]]>
  const temMaisHistorico = temMaisCandidatoRef.current || (isRh && temMaisVagaRef.current)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        title={collapsed ? 'Notificações' : undefined}
        aria-label="Notificações"
        className={cn(
          'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-slate-600 transition-fast hover:bg-slate-100 hover:text-slate-900',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="relative flex shrink-0">
          <Bell size={18} />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
          )}
        </span>
        {!collapsed && <span className="flex-1 truncate text-left">Notificações</span>}
        {!collapsed && total > 0 && (
          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5">
              <button
                onClick={() => abrirAba('novas')}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-fast',
                  aba === 'novas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
                )}
              >
                Novas
              </button>
              <button
                onClick={() => abrirAba('historico')}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-fast',
                  aba === 'historico' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
                )}
              >
                Histórico
              </button>
            </div>
            {aba === 'novas' &&
              (notificacoesEtapa.length > 0 || notificacoesVaga.length > 0) && (
                <button
                  onClick={marcarTudoLido}
                  className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Marcar tudo
                </button>
              )}
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {aba === 'novas' ? (
              semNotificacoesNovas ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Inbox size={22} className="text-slate-300" />
                  <p className="text-sm text-slate-400">Nenhuma novidade por aqui.</p>
                </div>
              ) : (
                <>
                  {resumoChat && resumoChat.candidatos.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Mensagens
                      </p>
                      {resumoChat.candidatos.map((item) => (
                        <button
                          key={item.candidato_id}
                          onClick={() => handleAbrirCandidato(item.candidato_id)}
                          className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                        >
                          <MessageCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {item.candidato_nome}
                          </span>
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                            {item.quantidade}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {resumoChat && resumoChat.vagas.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Mensagens de vagas
                      </p>
                      {resumoChat.vagas.map((item) => (
                        <button
                          key={item.vaga_id}
                          onClick={() => handleAbrirVaga(item.vaga_id)}
                          className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                        >
                          <MessageCircle size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {item.vaga_titulo}
                          </span>
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                            {item.quantidade}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {notificacoesEtapa.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Atividade
                      </p>
                      {notificacoesEtapa.map((item) => (
                        <div key={item.id} className="group flex items-start gap-2 px-4 py-2.5 hover:bg-slate-50">
                          <button
                            onClick={() => handleAbrirCandidato(item.candidato_id)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <ArrowRightLeft size={16} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-slate-700">{item.mensagem}</span>
                              <span className="text-xs text-slate-400">
                                {tempoRelativo(item.created_at)}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => marcarEtapaLida(item.id)}
                            title="Marcar como lida"
                            className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-white hover:text-emerald-600 group-hover:opacity-100"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {notificacoesVaga.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Vagas novas
                      </p>
                      {notificacoesVaga.map((item) => (
                        <div key={item.id} className="group flex items-start gap-2 px-4 py-2.5 hover:bg-slate-50">
                          <button
                            onClick={() => handleAbrirVaga(item.vaga_id)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <Briefcase size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-slate-700">{item.mensagem}</span>
                              <span className="text-xs text-slate-400">
                                {tempoRelativo(item.created_at)}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => marcarVagaLida(item.id)}
                            title="Marcar como lida"
                            className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-white hover:text-emerald-600 group-hover:opacity-100"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : historico.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Inbox size={22} className="text-slate-300" />
                <p className="text-sm text-slate-400">
                  {historicoCarregando ? 'Carregando...' : 'Nenhum histórico ainda.'}
                </p>
              </div>
            ) : (
              <>
                {historicoAgrupado.map(([bucket, itens]) => (
                  <div key={bucket}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {BUCKET_LABEL[bucket]}
                    </p>
                    {itens.map((item) => (
                      <button
                        key={item.id}
                        onClick={() =>
                          item.tipo === 'candidato'
                            ? handleAbrirCandidato(item.alvoId)
                            : handleAbrirVaga(item.alvoId)
                        }
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        {item.tipo === 'candidato' ? (
                          <ArrowRightLeft size={16} className="mt-0.5 shrink-0 text-slate-300" />
                        ) : (
                          <Briefcase size={16} className="mt-0.5 shrink-0 text-slate-300" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-500">{item.mensagem}</span>
                          <span className="text-xs text-slate-400">
                            {tempoRelativo(item.created_at)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {temMaisHistorico && (
                  <button
                    onClick={carregarHistorico}
                    disabled={historicoCarregando}
                    className="w-full border-t border-slate-100 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {historicoCarregando ? 'Carregando...' : 'Carregar mais'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
