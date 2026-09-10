import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import {
  useConcluirTarefa,
  useCreateTarefa,
  useDeleteTarefa,
  useReabrirTarefa,
  useTarefas,
  useUpdateTarefa,
} from '../../api/hooks/useTarefas'
import type { Tarefa, TarefaAlvoTipo } from '../../api/tarefas'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface TarefasSectionProps {
  alvoTipo: TarefaAlvoTipo
  alvoId: string
}

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function paraInputDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Bloco "Tarefas" dentro do painel de vaga/candidato: lista + criação
 * inline (título + data) + concluir/editar/excluir. */
export function TarefasSection({ alvoTipo, alvoId }: TarefasSectionProps) {
  const tarefasQuery = useTarefas({ alvo_tipo: alvoTipo, alvo_id: alvoId })
  const criar = useCreateTarefa()
  const concluir = useConcluirTarefa()
  const reabrir = useReabrirTarefa()
  const atualizar = useUpdateTarefa()
  const excluir = useDeleteTarefa()

  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editPrazo, setEditPrazo] = useState('')
  const [excluirId, setExcluirId] = useState<string | null>(null)

  const tarefas = tarefasQuery.data ?? []
  const alvoExcluir = tarefas.find((t) => t.id === excluirId) ?? null

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

  function abrirEdicao(t: Tarefa) {
    setEditId(t.id)
    setEditTitulo(t.titulo)
    setEditPrazo(paraInputDate(t.due_at))
  }

  function salvarEdicao(event: FormEvent) {
    event.preventDefault()
    if (!editId || !editTitulo.trim()) return
    atualizar.mutate({
      id: editId,
      input: { titulo: editTitulo.trim(), due_at: editPrazo ? `${editPrazo}T12:00:00` : null },
    })
    setEditId(null)
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tarefas</h3>

      {tarefas.length === 0 && <p className="text-xs text-slate-400">Nenhuma tarefa ainda.</p>}
      <ul className="space-y-1">
        {tarefas.map((t) =>
          editId === t.id ? (
            <li key={t.id}>
              <form onSubmit={salvarEdicao} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  value={editPrazo}
                  onChange={(e) => setEditPrazo(e.target.value)}
                  className="w-28 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-xs"
                />
                <button
                  type="submit"
                  disabled={!editTitulo.trim()}
                  className="shrink-0 rounded p-1 text-emerald-600 hover:bg-white disabled:opacity-40"
                  title="Salvar"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(null)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-white"
                  title="Cancelar"
                >
                  <X size={14} />
                </button>
              </form>
            </li>
          ) : (
            <li key={t.id} className="group flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.concluida}
                onChange={() => (t.concluida ? reabrir.mutate(t.id) : concluir.mutate(t.id))}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
              />
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate',
                  t.concluida && 'text-slate-400 line-through',
                )}
              >
                {t.titulo}
              </span>
              {t.due_at && (
                <span className="shrink-0 text-xs text-slate-400">{fmtData(t.due_at)}</span>
              )}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {!t.concluida && (
                  <button
                    type="button"
                    onClick={() => abrirEdicao(t)}
                    className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                    title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExcluirId(t.id)}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ),
        )}
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

      {alvoExcluir && (
        <ConfirmDialog
          title="Excluir tarefa"
          description={`"${alvoExcluir.titulo}" será removida permanentemente.`}
          onConfirm={() => {
            excluir.mutate(alvoExcluir.id)
            setExcluirId(null)
          }}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </div>
  )
}
