import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useConcluirTarefa, useCreateTarefa, useReabrirTarefa, useTarefas } from '../api/hooks/useTarefas'
import { BuscarButton } from '../components/board/BuscarButton'

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function vencida(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso as string) < new Date()
}

export function MinhasTarefasPage() {
  const { me } = useAuth()
  const tarefasQuery = useTarefas({ responsavel: me?.id })
  const criar = useCreateTarefa()
  const concluir = useConcluirTarefa()
  const reabrir = useReabrirTarefa()

  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')

  const tarefas = tarefasQuery.data ?? []
  const pendentes = [...tarefas]
    .filter((t) => !t.concluida)
    .sort((a, b) => {
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
  const concluidas = tarefas.filter((t) => t.concluida)

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
            {pendentes.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => concluir.mutate(t.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1 truncate text-slate-800">{t.titulo}</span>
                {t.due_at && (
                  <span
                    className={clsx('shrink-0 text-xs', vencida(t.due_at) ? 'text-red-600' : 'text-slate-400')}
                  >
                    {fmtData(t.due_at)}
                  </span>
                )}
              </label>
            ))}
          </div>

          {concluidas.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white opacity-70">
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Concluídas
              </p>
              {concluidas.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked
                    onChange={() => reabrir.mutate(t.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-400 line-through">{t.titulo}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
