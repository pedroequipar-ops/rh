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
        'flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 transition',
        'border-slate-200',
        aceitaDrop && 'ring-1 ring-sky-300',
        dropInvalido && isOver && 'ring-2 ring-red-300',
        aceitaDrop && isOver && 'ring-2 ring-sky-400',
      )}
    >
      <div className={clsx('flex items-center justify-between rounded-t-lg border-b px-3 py-2', meta.header)}>
        <span className="text-sm font-semibold">{meta.label}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{vagas.length}</span>
      </div>
      <div data-kanban-scrollable className="scrollbar-thin flex-1 overflow-y-auto p-2">
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
