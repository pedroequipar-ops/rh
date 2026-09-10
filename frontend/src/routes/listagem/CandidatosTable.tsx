import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '../../components/ui'
import type { Candidato } from '../../types'

interface CandidatosTableProps {
  candidatos: Candidato[]
  basePath: string
  isRh: boolean
  onDelete: (candidato: Candidato) => void
  /** false esconde o link de edição (nome e lápis) — só nome e excluir. */
  editavel?: boolean
  toolbarExtra?: ReactNode
  selecionados?: Set<string>
  onToggleSelecionado?: (id: string) => void
  onToggleTodos?: (ids: string[]) => void
}

export function CandidatosTable({
  candidatos,
  basePath,
  isRh,
  onDelete,
  editavel = true,
  toolbarExtra,
  selecionados,
  onToggleSelecionado,
  onToggleTodos,
}: CandidatosTableProps) {
  const columns: DataTableColumn<Candidato>[] = [
    {
      key: 'nome',
      label: 'Nome',
      value: (c) => c.nome,
      cell: (c) =>
        editavel ? (
          <Link to={`${basePath}/candidato/${c.id}`} className="font-medium text-slate-800 hover:underline">
            {c.nome}
          </Link>
        ) : (
          <span className="font-medium text-slate-800">{c.nome}</span>
        ),
    },
    {
      key: 'vaga',
      label: 'Vaga',
      value: (c) => c.vaga_titulo,
      cell: (c) => <span className="text-slate-600">{c.vaga_titulo}</span>,
    },
    {
      key: 'etapa',
      label: 'Etapa',
      value: (c) => c.etapa_atual.nome,
      groupable: true,
      cell: (c) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {c.etapa_atual.nome}
        </span>
      ),
    },
    {
      key: 'responsavel',
      label: 'Responsável',
      value: (c) => c.responsavel?.username ?? '',
      groupable: true,
      cell: (c) => <span className="text-slate-600">{c.responsavel?.username ?? '—'}</span>,
    },
    ...(isRh
      ? ([
          {
            key: 'acoes',
            label: 'Ações',
            align: 'right',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                {editavel && (
                  <Link
                    to={`${basePath}/candidato/${c.id}`}
                    className="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Editar candidato"
                  >
                    <Pencil size={16} />
                  </Link>
                )}
                <button
                  onClick={() => onDelete(c)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Excluir candidato"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ),
          },
        ] as DataTableColumn<Candidato>[])
      : []),
  ]

  return (
    <DataTable
      storageId="listagem-candidatos"
      columns={columns}
      rows={candidatos}
      rowKey={(c) => c.id}
      searchValue={(c) => `${c.nome} ${c.vaga_titulo}`}
      emptyMessage="Nenhum candidato cadastrado."
      toolbarExtra={toolbarExtra}
      selecionados={selecionados}
      onToggleSelecionado={onToggleSelecionado}
      onToggleTodos={onToggleTodos}
    />
  )
}
