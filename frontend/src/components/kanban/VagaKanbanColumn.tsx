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
  /** duplo clique numa área vazia da coluna (fora de um card) */
  onDoubleClick?: () => void
  selectedVagaId?: string | null
}

export function VagaKanbanColumn({
  status,
  vagas,
  draggable,
  vagaModalBase,
  aceitaDrop,
  dropInvalido,
  onDoubleClick,
  selectedVagaId,
}: VagaKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  const meta = VAGA_STATUS_META[status]

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={
        onDoubleClick
          ? (e) => {
              if ((e.target as HTMLElement).closest('[data-vaga-card]')) return
              onDoubleClick()
            }
          : undefined
      }
      className={clsx(
        'flex w-full min-h-0 flex-1 flex-col gap-2 rounded-lg p-1 transition-fast',
        aceitaDrop && 'bg-sky-50/60 ring-1 ring-sky-300',
        dropInvalido && isOver && 'ring-2 ring-red-300',
        aceitaDrop && isOver && 'bg-sky-50 ring-2 ring-sky-400',
      )}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-[2px]', meta.dot)} />
        <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
            selected={vaga.id === selectedVagaId}
          />
        ))}
        {vagas.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-slate-400">
            {onDoubleClick ? 'Duplo clique para criar vaga' : 'Nenhuma vaga'}
          </p>
        )}
      </div>
    </div>
  )
}
