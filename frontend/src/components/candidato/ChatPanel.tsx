import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import clsx from 'clsx'
import { listMensagens } from '../../api/chat'
import { tokenStorage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { ChatSocket, type ChatSocketStatus } from '../../ws/chatSocket'
import type { ChatMensagem } from '../../types'

interface ChatPanelProps {
  candidatoId: string
}

export function ChatPanel({ candidatoId }: ChatPanelProps) {
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

  useEffect(() => {
    let active = true
    listMensagens(candidatoId)
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
      candidatoId,
      token,
      companyId,
      onStatusChange: setStatus,
      onMessage: (data) => {
        const msg = data as ChatMensagem
        if (msg?.id && msg?.texto) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
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
  }, [candidatoId])

  const lastMessageId = messages[messages.length - 1]?.id ?? null
  useEffect(() => {
    if (lastMessageId) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId])

  async function handleLoadMore() {
    if (loadingMore || !temMaisAntigas) return
    setLoadingMore(true)
    const container = scrollRef.current
    const previousScrollHeight = container?.scrollHeight ?? 0
    try {
      const { mensagens, temMaisAntigas: hasMore, proximaPagina } = await listMensagens(
        candidatoId,
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
        <h3 className="text-sm font-semibold text-slate-800">Chat</h3>
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
        {messages.length === 0 && <p className="text-xs text-slate-400">Nenhuma mensagem ainda.</p>}
        {messages.map((msg) => {
          const mine = me && msg.autor_id === me.id
          return (
            <div key={msg.id} className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
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
