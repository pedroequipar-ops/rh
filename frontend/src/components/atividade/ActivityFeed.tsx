import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { useAtividadeFeed, useCriarComentario } from '../../api/hooks/useAtividade'
import type { AtividadeAlvoTipo } from '../../api/atividade'
import { ComentarioItem } from './Comentario'

interface ActivityFeedProps {
  alvoTipo: AtividadeAlvoTipo
  alvoId: string
}

export function ActivityFeed({ alvoTipo, alvoId }: ActivityFeedProps) {
  const { data: itens = [], isLoading } = useAtividadeFeed(alvoTipo, alvoId)
  const criarComentario = useCriarComentario(alvoTipo, alvoId)
  const [texto, setTexto] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!texto.trim()) return
    criarComentario.mutate(texto.trim(), { onSuccess: () => setTexto('') })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
        {!isLoading && itens.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma atividade ainda.</p>
        )}
        {itens.map((item) => (
          <ComentarioItem key={`${item.tipo}-${item.id}`} item={item} />
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-slate-200 p-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Comentar... @usuario pra mencionar"
          className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={criarComentario.isPending || !texto.trim()}
          className="flex items-center justify-center rounded bg-blue-600 px-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
          aria-label="Enviar comentário"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
