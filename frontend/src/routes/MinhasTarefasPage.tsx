import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  User,
  X,
} from 'lucide-react'
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
import { useVagas } from '../api/hooks/useVagas'
import { useCandidatos } from '../api/hooks/useCandidatos'
import type { Tarefa } from '../api/tarefas'
import { BuscarButton } from '../components/board/BuscarButton'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Badge, EmptyState, Textarea, type BadgeTone } from '../components/ui'

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** "2026-09-10T12:00:00Z" -> "2026-09-10" para o input date */
function paraInputDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

type Urgencia = 'atrasada' | 'hoje' | 'proxima' | 'sem-prazo'

function urgencia(t: Tarefa): Urgencia {
  if (!t.due_at) return 'sem-prazo'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje)
  amanha.setDate(hoje.getDate() + 1)
  const due = new Date(t.due_at)
  if (due < hoje) return 'atrasada'
  if (due < amanha) return 'hoje'
  return 'proxima'
}

const GRUPOS: Record<Urgencia, { label: string; icon: ReactNode; tone: BadgeTone; dot: string }> = {
  atrasada: { label: 'Atrasadas', icon: <AlertCircle size={13} />, tone: 'red', dot: 'text-red-500' },
  hoje: { label: 'Hoje', icon: <Clock size={13} />, tone: 'amber', dot: 'text-amber-500' },
  proxima: { label: 'Próximas', icon: <CalendarClock size={13} />, tone: 'slate', dot: 'text-slate-400' },
  'sem-prazo': { label: 'Sem prazo', icon: <Calendar size={13} />, tone: 'slate', dot: 'text-slate-300' },
}

export function MinhasTarefasPage() {
  const { me } = useAuth()
  const base = me?.role === 'RH' ? '/rh' : '/setor'
  const tarefasQuery = useTarefas({ responsavel: me?.id })
  const vagasQuery = useVagas()
  const candidatosQuery = useCandidatos()
  const criar = useCreateTarefa()
  const concluir = useConcluirTarefa()
  const reabrir = useReabrirTarefa()
  const atualizar = useUpdateTarefa()
  const excluir = useDeleteTarefa()

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editPrazo, setEditPrazo] = useState('')
  const [excluirId, setExcluirId] = useState<string | null>(null)

  const tarefas = tarefasQuery.data ?? []
  const vagas = vagasQuery.data ?? []
  const candidatos = candidatosQuery.data ?? []
  const concluidas = tarefas.filter((t) => t.concluida)
  const alvoExcluir = tarefas.find((t) => t.id === excluirId) ?? null

  const grupos: Record<Urgencia, Tarefa[]> = {
    atrasada: [],
    hoje: [],
    proxima: [],
    'sem-prazo': [],
  }
  for (const t of tarefas) {
    if (t.concluida) continue
    grupos[urgencia(t)].push(t)
  }
  for (const lista of Object.values(grupos)) {
    lista.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  }
  const totalPendentes = tarefas.filter((t) => !t.concluida).length

  function vinculoDe(t: Tarefa): { label: string; href: string; icon: ReactNode } | null {
    if (t.alvo_tipo === 'VAGA' && t.alvo_id) {
      const vaga = vagas.find((v) => v.id === t.alvo_id)
      if (!vaga) return null
      return { label: vaga.titulo, href: `${base}/vagas/vaga/${vaga.id}`, icon: <Briefcase size={11} /> }
    }
    if (t.alvo_tipo === 'CANDIDATO' && t.alvo_id) {
      const candidato = candidatos.find((c) => c.id === t.alvo_id)
      if (!candidato) return null
      return {
        label: candidato.nome,
        href: `${base}/pessoas/candidato/${candidato.id}`,
        icon: <User size={11} />,
      }
    }
    return null
  }

  function handleCriar(event: FormEvent) {
    event.preventDefault()
    if (!titulo.trim() || !me) return
    criar.mutate({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      due_at: prazo ? `${prazo}T12:00:00` : undefined,
      responsavel_id: me.id,
    })
    setTitulo('')
    setDescricao('')
    setPrazo('')
  }

  function abrirEdicao(t: Tarefa) {
    setEditId(t.id)
    setEditTitulo(t.titulo)
    setEditDescricao(t.descricao)
    setEditPrazo(paraInputDate(t.due_at))
  }

  function salvarEdicao(event: FormEvent) {
    event.preventDefault()
    if (!editId || !editTitulo.trim()) return
    atualizar.mutate({
      id: editId,
      input: {
        titulo: editTitulo.trim(),
        descricao: editDescricao.trim(),
        due_at: editPrazo ? `${editPrazo}T12:00:00` : null,
      },
    })
    setEditId(null)
  }

  function confirmarExclusao() {
    if (excluirId) excluir.mutate(excluirId)
    setExcluirId(null)
  }

  function linhaTarefa(t: Tarefa, concluida: boolean) {
    if (editId === t.id) {
      return (
        <form
          key={t.id}
          onSubmit={salvarEdicao}
          className="space-y-2 border-b border-slate-100 px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-2">
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
          </div>
          <Textarea
            value={editDescricao}
            onChange={(e) => setEditDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="text-sm"
          />
        </form>
      )
    }

    const vinculo = vinculoDe(t)
    return (
      <div
        key={t.id}
        className="group flex items-start gap-2.5 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
      >
        <input
          type="checkbox"
          checked={concluida}
          onChange={() => (concluida ? reabrir.mutate(t.id) : concluir.mutate(t.id))}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'min-w-0 flex-1 truncate',
                concluida ? 'text-slate-400 line-through' : 'font-medium text-slate-800',
              )}
            >
              {t.titulo}
            </span>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!concluida && (
                <button
                  type="button"
                  onClick={() => abrirEdicao(t)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
              )}
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
          {t.descricao && !concluida && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.descricao}</p>
          )}
          {(t.due_at || vinculo) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {t.due_at && (
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 text-xs',
                    !concluida && urgencia(t) === 'atrasada' ? 'text-red-600' : 'text-slate-400',
                  )}
                >
                  <Calendar size={11} />
                  {fmtData(t.due_at)}
                </span>
              )}
              {vinculo && (
                <Link
                  to={vinculo.href}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                >
                  {vinculo.icon}
                  <span className="max-w-[10rem] truncate">{vinculo.label}</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold text-slate-800">Minhas tarefas</h1>
          {totalPendentes > 0 && <Badge tone="slate">{totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}</Badge>}
        </div>
        <BuscarButton />
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-xl space-y-4">
          <form
            onSubmit={handleCriar}
            className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
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
            </div>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              className="text-sm"
            />
          </form>

          <div className="rounded-lg border border-slate-200 bg-white">
            {tarefasQuery.isLoading && <p className="p-4 text-sm text-slate-400">Carregando...</p>}
            {!tarefasQuery.isLoading && totalPendentes === 0 && (
              <EmptyState icon={<CheckCircle2 size={32} />} title="Nenhuma tarefa pendente." />
            )}
            {(Object.keys(GRUPOS) as Urgencia[]).map((chave) => {
              const lista = grupos[chave]
              if (lista.length === 0) return null
              const meta = GRUPOS[chave]
              return (
                <div key={chave}>
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-1.5">
                    <span className={meta.dot}>{meta.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {meta.label}
                    </span>
                    <Badge tone={meta.tone}>{lista.length}</Badge>
                  </div>
                  {lista.map((t) => linhaTarefa(t, false))}
                </div>
              )
            })}
          </div>

          {concluidas.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Concluídas
              </p>
              {concluidas.map((t) => linhaTarefa(t, true))}
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
