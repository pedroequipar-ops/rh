import { useState, type FormEvent } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import {
  useConcluirTarefa,
  useCreateTarefa,
  useDeleteTarefa,
  useReabrirTarefa,
  useTarefas,
  useUpdateTarefa,
} from '../api/hooks/useTarefas'
import type { Tarefa } from '../api/tarefas'
import { BuscarButton } from '../components/board/BuscarButton'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function vencida(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso as string) < new Date()
}

/** "2026-09-10T12:00:00Z" -> "2026-09-10" para o input date */
function paraInputDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export function MinhasTarefasPage() {
  const { me } = useAuth()
  const tarefasQuery = useTarefas({ responsavel: me?.id })
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
  const pendentes = [...tarefas]
    .filter((t) => !t.concluida)
    .sort((a, b) => {
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
  const concluidas = tarefas.filter((t) => t.concluida)
  const alvoExcluir = tarefas.find((t) => t.id === excluirId) ?? null

  function handleCriar(event: FormEvent) {
    event.preventDefault()
    if (!titulo.trim() || !me) return
    criar.mutate({
      titulo: titulo.trim(),
      due_at: prazo ? `${prazo}T12:00:00` : undefined,
      responsavel_id: me.id,
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

  function confirmarExclusao() {
    if (excluirId) excluir.mutate(excluirId)
    setExcluirId(null)
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <h1 className="text-lg font-semibold text-slate-800">Minhas tarefas</h1>
        <BuscarButton />
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-xl space-y-4">
          <form
            onSubmit={handleCriar}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nova tarefa..."
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-36 shrink-0 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={!titulo.trim() || criar.isPending}
              className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Adicionar
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white">
            {tarefasQuery.isLoading && <p className="p-4 text-sm text-slate-400">Carregando...</p>}
            {!tarefasQuery.isLoading && pendentes.length === 0 && (
              <p className="p-4 text-sm text-slate-400">Nenhuma tarefa pendente.</p>
            )}
            {pendentes.map((t) =>
              editId === t.id ? (
                <form
                  key={t.id}
                  onSubmit={salvarEdicao}
                  className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0"
                >
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
                    className="w-32 shrink-0 rounded border border-slate-300 px-1.5 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!editTitulo.trim()}
                    className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                    title="Salvar"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
                    title="Cancelar"
                  >
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <div
                  key={t.id}
                  className="group flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => concluir.mutate(t.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-800">{t.titulo}</span>
                  {t.due_at && (
                    <span
                      className={clsx(
                        'shrink-0 text-xs',
                        vencida(t.due_at) ? 'text-red-600' : 'text-slate-400',
                      )}
                    >
                      {fmtData(t.due_at)}
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(t)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluirId(t.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>

          {concluidas.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Concluídas
              </p>
              {concluidas.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked
                    onChange={() => reabrir.mutate(t.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-400 line-through">
                    {t.titulo}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExcluirId(t.id)}
                    className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {alvoExcluir && (
        <ConfirmDialog
          title="Excluir tarefa"
          description={`"${alvoExcluir.titulo}" será removida permanentemente.`}
          onConfirm={confirmarExclusao}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </div>
  )
}
