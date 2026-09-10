import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { VAGA_STATUS_META } from '../../constants/vagaStatus'
import { VagaKanbanCard } from './VagaKanbanCard'

interface VagaKanbanColumnProps {
  status: VagaStatus
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  /** vaga sendo arrastada: destaca colunas que aceitam o drop */
  aceitaDrop?: boolean
  dropInvalido?: boolean
}

export function VagaKanbanColumn({
  status,
  vagas,
  draggable,
  vagaModalBase,
  aceitaDrop,
  dropInvalido,
}: VagaKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  const meta = VAGA_STATUS_META[status]

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg p-1 transition-fast',
        aceitaDrop && 'bg-sky-50/60 ring-1 ring-sky-300',
        dropInvalido && isOver && 'ring-2 ring-red-300',
        aceitaDrop && isOver && 'bg-sky-50 ring-2 ring-sky-400',
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span className={clsx('h-2 w-2 shrink-0 rounded-[3px]', meta.dot)} />
        <span className="text-[13px] font-semibold text-slate-700">{meta.label}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {vagas.length}
        </span>
      </div>
      <div
        data-kanban-scrollable
        className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1"
      >
        {vagas.map((vaga) => (
          <VagaKanbanCard
            key={vaga.id}
            vaga={vaga}
            draggable={draggable}
            vagaModalBase={vagaModalBase}
          />
        ))}
        {vagas.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Nenhuma vaga</p>}
      </div>
    </div>
  )
}
