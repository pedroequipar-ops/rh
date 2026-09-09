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
import type { Candidato, EtapaKanban, Vaga, VagaStatus } from '../../types'
import { FLUXO_STATUSES } from '../../constants/vagaStatus'
import { CandidatoCardContent } from './CandidatoCard'
import { KanbanColumn } from './KanbanColumn'
import { VagaKanbanCardContent } from './VagaKanbanCard'
import { VagaKanbanColumn } from './VagaKanbanColumn'

interface KanbanBoardProps {
  etapas: EtapaKanban[]
  candidatos: Candidato[]
  draggable: boolean
  candidatoModalBase: string
  onMoveCandidato?: (candidatoId: string, etapaId: string) => void
  /** quando presente, o board mostra as colunas de fluxo de vaga antes da triagem */
  vagas?: Vaga[]
  vagaModalBase?: string
  onMoveVaga?: (vagaId: string, status: VagaStatus) => void
}

export function KanbanBoard({
  etapas,
  candidatos,
  draggable,
  candidatoModalBase,
  onMoveCandidato,
  vagas,
  vagaModalBase,
  onMoveVaga,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)

  const sortedEtapas = [...etapas].sort((a, b) => {
    if (a.is_saida_negativa !== b.is_saida_negativa) return a.is_saida_negativa ? 1 : -1
    return a.ordem - b.ordem
  })

  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas?.find((v) => v.id === activeVagaId) ?? null : null
  const activeCandidato =
    activeId && !activeVagaId ? candidatos.find((c) => c.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    if (activeIdStr.startsWith('vaga:')) {
      if (!overIdStr.startsWith('status:')) return
      const vagaId = activeIdStr.slice(5)
      const destino = overIdStr.slice(7) as VagaStatus
      const vaga = vagas?.find((v) => v.id === vagaId)
      if (!vaga || vaga.status === destino) return
      if (!vaga.transicoes_disponiveis.includes(destino)) return
      onMoveVaga?.(vagaId, destino)
      return
    }

    if (overIdStr.startsWith('status:')) return
    const candidato = candidatos.find((c) => c.id === active.id)
    if (!candidato || candidato.etapa_atual.id === over.id) return
    onMoveCandidato?.(activeIdStr, overIdStr)
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
        return
      }
    }

    event.currentTarget.scrollLeft += event.deltaY
    event.preventDefault()
  }

  const board = (
    <div className="scrollbar-thin flex h-full gap-4 overflow-x-auto p-4" onWheel={handleWheel}>
      {vagas &&
        vagaModalBase &&
        FLUXO_STATUSES.map((status) => (
          <VagaKanbanColumn
            key={status}
            status={status}
            vagas={vagas.filter((v) => v.status === status)}
            draggable={draggable && !!onMoveVaga}
            vagaModalBase={vagaModalBase}
            aceitaDrop={!!activeVaga && activeVaga.transicoes_disponiveis.includes(status)}
            dropInvalido={
              !!activeVaga &&
              !activeVaga.transicoes_disponiveis.includes(status) &&
              activeVaga.status !== status
            }
          />
        ))}
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
        {activeVaga && (
          <div className="w-72 scale-[1.02] rounded-md border border-slate-200 bg-white p-3 opacity-95 shadow-md">
            <VagaKanbanCardContent vaga={activeVaga} />
          </div>
        )}
        {activeCandidato && (
          <div className="w-72 scale-[1.02] rounded-md border border-slate-200 bg-white p-3 opacity-95 shadow-md">
            <CandidatoCardContent candidato={activeCandidato} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
