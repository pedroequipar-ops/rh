import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import clsx from 'clsx'
import { useConcluirTarefa, useCreateTarefa, useReabrirTarefa, useTarefas } from '../../api/hooks/useTarefas'
import type { TarefaAlvoTipo } from '../../api/tarefas'

interface TarefasSectionProps {
  alvoTipo: TarefaAlvoTipo
  alvoId: string
}

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Bloco "Tarefas" dentro do painel de vaga/candidato: lista + criação
 * inline (título + data) + checkbox para concluir. */
export function TarefasSection({ alvoTipo, alvoId }: TarefasSectionProps) {
  const tarefasQuery = useTarefas({ alvo_tipo: alvoTipo, alvo_id: alvoId })
  const criar = useCreateTarefa()
  const concluir = useConcluirTarefa()
  const reabrir = useReabrirTarefa()

  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')

  const tarefas = tarefasQuery.data ?? []

  function handleCriar(event: FormEvent) {
    event.preventDefault()
    if (!titulo.trim()) return
    criar.mutate({
      titulo: titulo.trim(),
      due_at: prazo ? `${prazo}T12:00:00` : undefined,
      alvo_tipo: alvoTipo,
      alvo_id: alvoId,
    })
    setTitulo('')
    setPrazo('')
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tarefas</h3>

      {tarefas.length === 0 && <p className="text-xs text-slate-400">Nenhuma tarefa ainda.</p>}
      <ul className="space-y-1">
        {tarefas.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.concluida}
              onChange={() => (t.concluida ? reabrir.mutate(t.id) : concluir.mutate(t.id))}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            <span className={clsx('min-w-0 flex-1 truncate', t.concluida && 'text-slate-400 line-through')}>
              {t.titulo}
            </span>
            {t.due_at && <span className="shrink-0 text-xs text-slate-400">{fmtData(t.due_at)}</span>}
          </li>
        ))}
      </ul>

      <form onSubmit={handleCriar} className="flex items-center gap-1.5 pt-1">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nova tarefa..."
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="w-32 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={!titulo.trim() || criar.isPending}
          className="shrink-0 rounded border border-slate-300 p-1.5 text-slate-600 hover:bg-white disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </form>
    </div>
  )
}
