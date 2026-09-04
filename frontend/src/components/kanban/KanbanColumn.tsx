import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Candidato, EtapaKanban } from '../../types'
import { CandidatoCard } from './CandidatoCard'

interface KanbanColumnProps {
  etapa: EtapaKanban
  candidatos: Candidato[]
  draggable: boolean
  candidatoModalBase: string
}

export function KanbanColumn({ etapa, candidatos, draggable, candidatoModalBase }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 transition',
        etapa.is_saida_negativa ? 'border-red-200' : 'border-slate-200',
        isOver && 'ring-2 ring-slate-400',
      )}
    >
      <div
        className={clsx(
          'flex items-center justify-between rounded-t-lg border-b px-3 py-2',
          etapa.is_saida_negativa ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
        )}
      >
        <span
          className={clsx(
            'text-sm font-semibold',
            etapa.is_saida_negativa ? 'text-red-700' : 'text-slate-700',
          )}
        >
          {etapa.nome}
        </span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
          {candidatos.length}
        </span>
      </div>
      <div data-kanban-scrollable className="flex-1 overflow-y-auto p-2">
        {candidatos.map((candidato) => (
          <CandidatoCard
            key={candidato.id}
            candidato={candidato}
            draggable={draggable}
            candidatoModalBase={candidatoModalBase}
          />
        ))}
        {candidatos.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Nenhum candidato</p>}
      </div>
    </div>
  )
}
