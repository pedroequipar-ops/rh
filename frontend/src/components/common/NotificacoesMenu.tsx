import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Bell, Briefcase, Inbox, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getVagaNotificacoes,
  marcarVagaNotificacoesComoLidas,
  type VagaNotificacaoNova,
} from '../../api/vagas'
import { getNaoLidas, type NaoLidasResumo } from '../../api/chat'
import {
  getNotificacoesEtapa,
  marcarNotificacoesEtapaComoLidas,
  type CandidatoNotificacaoEtapa,
} from '../../api/candidatos'
import { notificacaoHref } from '../../lib/notificacaoHref'
import { cn } from '../ui/cn'

const NOTIFICACOES_POLL_MS = 20000

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

export function NotificacoesMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const [open, setOpen] = useState(false)
  const [resumoChat, setResumoChat] = useState<NaoLidasResumo | null>(null)
  const [notificacoesEtapa, setNotificacoesEtapa] = useState<CandidatoNotificacaoEtapa[]>([])
  const [notificacoesVaga, setNotificacoesVaga] = useState<VagaNotificacaoNova[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    function carregar() {
      getNaoLidas()
        .then((data) => {
          if (active) setResumoChat(data)
        })
        .catch(() => {})
      getNotificacoesEtapa()
        .then((data) => {
          if (active) setNotificacoesEtapa(data)
        })
        .catch(() => {})
      if (isRh) {
        getVagaNotificacoes()
          .then((data) => {
            if (active) setNotificacoesVaga(data)
          })
          .catch(() => {})
      }
    }
    carregar()
    const interval = setInterval(carregar, NOTIFICACOES_POLL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
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
    setOpen((v) => {
      const next = !v
      if (next && notificacoesEtapa.length > 0) {
        marcarNotificacoesEtapaComoLidas().catch(() => {})
      }
      if (next && notificacoesVaga.length > 0) {
        marcarVagaNotificacoesComoLidas().catch(() => {})
      }
      return next
    })
  }

  function handleAbrirCandidato(candidatoId: string) {
    setOpen(false)
    navigate(notificacaoHref(me!.role, 'candidato', candidatoId))
  }

  function handleAbrirVaga(vagaId: string) {
    setOpen(false)
    navigate(notificacaoHref(me!.role, 'vaga', vagaId))
  }

  const semNotificacoes =
    (!resumoChat || (resumoChat.candidatos.length === 0 && resumoChat.vagas.length === 0)) &&
    notificacoesEtapa.length === 0 &&
    notificacoesVaga.length === 0

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
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Notificações</h3>
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {semNotificacoes ? (
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
                      <button
                        key={item.id}
                        onClick={() => handleAbrirCandidato(item.candidato_id)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <ArrowRightLeft size={16} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-700">{item.mensagem}</span>
                          <span className="text-xs text-slate-400">{tempoRelativo(item.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {notificacoesVaga.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Vagas novas
                    </p>
                    {notificacoesVaga.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAbrirVaga(item.vaga_id)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <Briefcase size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-700">{item.mensagem}</span>
                          <span className="text-xs text-slate-400">{tempoRelativo(item.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
