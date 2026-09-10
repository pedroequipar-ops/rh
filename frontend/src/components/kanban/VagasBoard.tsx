import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Vaga, VagaStatus } from '../../types'
import { COLUNAS_OCULTAS_SE_VAZIAS, FLUXO_STATUSES } from '../../constants/vagaStatus'
import { useHorizontalWheel } from './useHorizontalWheel'
import { VagaKanbanCardContent } from './VagaKanbanCard'
import { VagaKanbanColumn } from './VagaKanbanColumn'

interface VagasBoardProps {
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  /** rota da tela de criar vaga; duplo clique na coluna "Solicitada" abre ela */
  novaVagaHref?: string
  onMoveVaga?: (vagaId: string, status: VagaStatus) => void
}

/** Board só de vagas: colunas de status. "Em triagem" aparece como chip
 * não-arrastável — quem circula ali é o board Pessoas. */
export function VagasBoard({
  vagas,
  draggable,
  vagaModalBase,
  novaVagaHref,
  onMoveVaga,
}: VagasBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const handleWheel = useHorizontalWheel()
  const navigate = useNavigate()

  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null
  const emTriagem = vagas.filter((v) => v.status === 'EM_TRIAGEM')

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const vagaId = String(active.id).slice(5)
    const vaga = vagas.find((v) => v.id === vagaId)
    if (!vaga) return
    const overIdStr = String(over.id)
    if (!overIdStr.startsWith('status:')) return
    const destino = overIdStr.slice(7) as VagaStatus
    if (vaga.status === destino) return
    if (!vaga.transicoes_disponiveis.includes(destino)) return
    onMoveVaga?.(vagaId, destino)
  }

  const board = (
    <div
      className="scrollbar-thin flex h-full gap-9 overflow-x-auto p-5"
      onWheel={handleWheel}
    >
      {FLUXO_STATUSES.filter((status) => {
        if (!COLUNAS_OCULTAS_SE_VAZIAS.includes(status)) return true
        if (vagas.some((v) => v.status === status)) return true
        return !!activeVaga && activeVaga.transicoes_disponiveis.includes(status)
      }).map((status) => (
        <VagaKanbanColumn
          key={status}
          status={status}
          vagas={vagas.filter((v) => v.status === status)}
          draggable={draggable}
          vagaModalBase={vagaModalBase}
          onDoubleClick={
            status === 'SOLICITADA' && novaVagaHref
              ? () => navigate(novaVagaHref)
              : undefined
          }
          aceitaDrop={!!activeVaga && activeVaga.transicoes_disponiveis.includes(status)}
          dropInvalido={
            !!activeVaga &&
            !activeVaga.transicoes_disponiveis.includes(status) &&
            activeVaga.status !== status
          }
        />
      ))}
      <VagaKanbanColumn
        status="EM_TRIAGEM"
        vagas={emTriagem}
        draggable={false}
        vagaModalBase={vagaModalBase}
      />
    </div>
  )

  if (!draggable) return board

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
          <div className="w-[244px] scale-[1.02] rounded-lg border border-slate-200 bg-white p-2 opacity-95 shadow-md">
            <VagaKanbanCardContent vaga={activeVaga} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
