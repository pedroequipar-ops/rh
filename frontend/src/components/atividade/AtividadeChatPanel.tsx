import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRightLeft, History, Send } from 'lucide-react'
import clsx from 'clsx'
import { listMensagens, marcarMensagensComoLidas } from '../../api/chat'
import { tokenStorage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { ChatSocket, type ChatKind, type ChatSocketStatus } from '../../ws/chatSocket'
import type { ChatMensagem } from '../../types'
import { useAtividadeFeed } from '../../api/hooks/useAtividade'
import type { AtividadeFeedItem } from '../../api/atividade'

interface AtividadeChatPanelProps {
  kind: ChatKind
  id: string
  title?: string
}

type ItemUnificado =
  | { chave: string; created_at: string; tipo: 'chat'; msg: ChatMensagem }
  | { chave: string; created_at: string; tipo: 'log'; item: AtividadeFeedItem }

const ICONES_LOG = {
  atividade: ArrowRightLeft,
  historico: History,
  comentario: History,
} as const

function LinhaLog({ item }: { item: AtividadeFeedItem }) {
  const Icone = ICONES_LOG[item.tipo]
  return (
    <div className="flex items-start gap-2 py-0.5 text-xs text-slate-500">
      <Icone size={12} className="mt-0.5 shrink-0 text-slate-400" />
      <p>
        <span className="font-medium text-slate-600">{item.autor}</span>{' '}
        {item.tipo === 'comentario' ? `comentou: "${item.descricao}"` : item.descricao}
      </p>
    </div>
  )
}

/** Feed único: chat em tempo real (WebSocket) com as atualizações da vaga/
 * candidato (mudança de etapa, aprovação etc.) intercaladas por horário —
 * era duas abas (Chat + Atividade), virou uma só. */
export function AtividadeChatPanel({ kind, id, title = 'Atividade' }: AtividadeChatPanelProps) {
  const { me } = useAuth()
  const [messages, setMessages] = useState<ChatMensagem[]>([])
  const [status, setStatus] = useState<ChatSocketStatus>('connecting')
  const [draft, setDraft] = useState('')
  const [temMaisAntigas, setTemMaisAntigas] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const proximaPaginaRef = useRef(2)
  const socketRef = useRef<ChatSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: atividadeItens = [] } = useAtividadeFeed(kind, id)

  useEffect(() => {
    let active = true
    listMensagens(kind, id)
      .then(({ mensagens, temMaisAntigas: hasMore, proximaPagina }) => {
        if (!active) return
        setMessages(mensagens)
        setTemMaisAntigas(hasMore)
        proximaPaginaRef.current = proximaPagina
      })
      .catch(() => {
        if (active) setMessages([])
      })

    const token = tokenStorage.getAccess()
    const companyId = tokenStorage.getCompanyId()
    if (!token || !companyId) return

    const socket = new ChatSocket({
      kind,
      id,
      token,
      companyId,
      onStatusChange: setStatus,
      onMessage: (data) => {
        const msg = data as ChatMensagem
        if (msg?.id && msg?.texto) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          marcarMensagensComoLidas(kind, id).catch(() => {})
        }
      },
    })
    socket.connect()
    socketRef.current = socket

    return () => {
      active = false
      socket.close()
      socketRef.current = null
    }
  }, [kind, id])

  const itensUnificados: ItemUnificado[] = [
    ...messages.map((msg) => ({ chave: `chat-${msg.id}`, created_at: msg.created_at, tipo: 'chat' as const, msg })),
    ...atividadeItens.map((item) => ({
      chave: `log-${item.tipo}-${item.id}`,
      created_at: item.created_at,
      tipo: 'log' as const,
      item,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const ultimoItemChave = itensUnificados[itensUnificados.length - 1]?.chave ?? null
  useEffect(() => {
    if (ultimoItemChave) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoItemChave])

  async function handleLoadMore() {
    if (loadingMore || !temMaisAntigas) return
    setLoadingMore(true)
    const container = scrollRef.current
    const previousScrollHeight = container?.scrollHeight ?? 0
    try {
      const { mensagens, temMaisAntigas: hasMore, proximaPagina } = await listMensagens(
        kind,
        id,
        proximaPaginaRef.current,
      )
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        return [...mensagens.filter((m) => !existingIds.has(m.id)), ...prev]
      })
      setTemMaisAntigas(hasMore)
      proximaPaginaRef.current = proximaPagina
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousScrollHeight
      })
    } catch {
      // mantém o estado atual se a página seguinte falhar; usuário pode tentar de novo
    } finally {
      setLoadingMore(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    socketRef.current?.send({ texto: draft.trim() })
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col border-l border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span
          className={clsx(
            'flex items-center gap-1.5 text-xs',
            status === 'open' && 'text-green-600',
            status === 'connecting' && 'text-amber-500',
            status === 'closed' && 'text-red-500',
          )}
        >
          <span
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              status === 'open' && 'bg-green-500',
              status === 'connecting' && 'bg-amber-400',
              status === 'closed' && 'bg-red-500',
            )}
          />
          {status === 'open' ? 'conectado' : status === 'connecting' ? 'conectando...' : 'desconectado'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {temMaisAntigas && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}
            </button>
          </div>
        )}
        {itensUnificados.length === 0 && <p className="text-xs text-slate-400">Nada por aqui ainda.</p>}
        {itensUnificados.map((entrada) => {
          if (entrada.tipo === 'log') return <LinhaLog key={entrada.chave} item={entrada.item} />
          const msg = entrada.msg
          const mine = me && msg.autor_id === me.id
          return (
            <div key={entrada.chave} className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <span className="mb-0.5 text-[11px] text-slate-400">{msg.autor}</span>
              <div
                className={clsx(
                  'max-w-[80%] rounded-lg px-3 py-1.5 text-sm',
                  mine ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800',
                )}
              >
                {msg.texto}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status !== 'open' || !draft.trim()}
          className="flex items-center justify-center rounded bg-slate-800 px-3 text-white hover:bg-slate-900 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
