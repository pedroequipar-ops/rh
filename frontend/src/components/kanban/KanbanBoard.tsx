import { useState, type WheelEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Candidato, EtapaKanban } from '../../types'
import { CandidatoCardContent } from './CandidatoCard'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  etapas: EtapaKanban[]
  candidatos: Candidato[]
  draggable: boolean
  candidatoModalBase: string
  onMoveCandidato?: (candidatoId: string, etapaId: string) => void
}

export function KanbanBoard({
  etapas,
  candidatos,
  draggable,
  candidatoModalBase,
  onMoveCandidato,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)

  const sortedEtapas = [...etapas].sort((a, b) => {
    if (a.is_saida_negativa !== b.is_saida_negativa) return a.is_saida_negativa ? 1 : -1
    return a.ordem - b.ordem
  })

  const activeCandidato = activeId ? candidatos.find((c) => c.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const candidato = candidatos.find((c) => c.id === active.id)
    if (!candidato || candidato.etapa_atual.id === over.id) return
    onMoveCandidato?.(String(active.id), String(over.id))
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY === 0) return

    const target = event.target as HTMLElement
    const columnList = target.closest('[data-kanban-scrollable]') as HTMLElement | null

    if (columnList) {
      const { scrollTop, scrollHeight, clientHeight } = columnList
      const podeDescer = event.deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1
      const podeSubir = event.deltaY < 0 && scrollTop > 0
      if (podeDescer || podeSubir) {
        // a coluna ainda tem espaço pra rolar verticalmente: deixa o scroll nativo agir nela
        return
      }
    }

    event.currentTarget.scrollLeft += event.deltaY
    event.preventDefault()
  }

  const board = (
    <div className="scrollbar-thin flex h-full gap-4 overflow-x-auto p-4" onWheel={handleWheel}>
      {sortedEtapas.map((etapa) => (
        <KanbanColumn
          key={etapa.id}
          etapa={etapa}
          candidatos={candidatos.filter((c) => c.etapa_atual.id === etapa.id)}
          draggable={draggable}
          candidatoModalBase={candidatoModalBase}
        />
      ))}
    </div>
  )

  if (!draggable) {
    return board
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {board}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
        {activeCandidato && (
          <div className="w-72 scale-[1.02] rounded-md border border-slate-200 bg-white p-3 opacity-95 shadow-md">
            <CandidatoCardContent candidato={activeCandidato} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
