import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { DataTable, type DataTableColumn } from '../../components/ui'
import { PRIORIDADE_META, VAGA_STATUS_META } from '../../constants/vagaStatus'
import type { Vaga } from '../../types'

interface VagasTableProps {
  vagas: Vaga[]
  basePath: string
  onDelete: (vaga: Vaga) => void
  /** false esconde o link de edição (título e lápis) — só título e excluir. */
  editavel?: boolean
  toolbarExtra?: ReactNode
  selecionados?: Set<string>
  onToggleSelecionado?: (id: string) => void
  onToggleTodos?: (ids: string[]) => void
}

export function VagasTable({
  vagas,
  basePath,
  onDelete,
  editavel = true,
  toolbarExtra,
  selecionados,
  onToggleSelecionado,
  onToggleTodos,
}: VagasTableProps) {
  const columns: DataTableColumn<Vaga>[] = [
    {
      key: 'titulo',
      label: 'Título',
      value: (v) => v.titulo,
      cell: (v) => (
        <>
          {editavel ? (
            <Link to={`${basePath}/vaga/${v.id}`} className="font-medium text-slate-800 hover:underline">
              {v.titulo}
            </Link>
          ) : (
            <span className="font-medium text-slate-800">{v.titulo}</span>
          )}
          {v.urgente && (
            <span className="ml-2 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
              Urgente
            </span>
          )}
          {!v.urgente && v.prioridade === 3 && (
            <span className={clsx('ml-2 rounded border px-1.5 py-0.5 text-[11px] font-medium', PRIORIDADE_META[3].badge)}>
              Alta
            </span>
          )}
        </>
      ),
    },
    {
      key: 'setor',
      label: 'Setor',
      value: (v) => v.setor.nome,
      groupable: true,
      cell: (v) => <span className="text-slate-600">{v.setor.nome}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      value: (v) => v.status_display,
      groupable: true,
      cell: (v) => (
        <span className={clsx('rounded border px-2 py-0.5 text-xs font-medium', VAGA_STATUS_META[v.status]?.badge)}>
          {VAGA_STATUS_META[v.status]?.label ?? v.status}
        </span>
      ),
    },
    {
      key: 'responsavel',
      label: 'Responsável',
      value: (v) => v.responsavel?.username ?? '',
      groupable: true,
      cell: (v) => <span className="text-slate-600">{v.responsavel?.username ?? '—'}</span>,
    },
    {
      key: 'quantidade',
      label: 'Vagas',
      value: (v) => v.quantidade_vagas,
      cell: (v) => <span className="text-slate-600">{v.quantidade_vagas}</span>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      cell: (v) => (
        <div className="flex justify-end gap-0.5">
          {editavel && (
            <Link
              to={`${basePath}/vaga/${v.id}`}
              className="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Editar vaga"
            >
              <Pencil size={16} />
            </Link>
          )}
          <button
            onClick={() => onDelete(v)}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Excluir vaga"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      storageId="listagem-vagas"
      columns={columns}
      rows={vagas}
      rowKey={(v) => v.id}
      searchValue={(v) => `${v.titulo} ${v.setor.nome}`}
      emptyMessage="Nenhuma vaga encontrada."
      toolbarExtra={toolbarExtra}
      selecionados={selecionados}
      onToggleSelecionado={onToggleSelecionado}
      onToggleTodos={onToggleTodos}
    />
  )
}
