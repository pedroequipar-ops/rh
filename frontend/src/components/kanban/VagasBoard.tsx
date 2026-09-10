import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Vaga, VagaStatus } from '../../types'
import { FLUXO_STATUSES, STATUS_ORBS } from '../../constants/vagaStatus'
import { useHorizontalWheel } from './useHorizontalWheel'
import { VagaKanbanCardContent } from './VagaKanbanCard'
import { VagaKanbanColumn } from './VagaKanbanColumn'
import { VagaStatusOrbs } from './VagaStatusOrbs'

interface VagasBoardProps {
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  /** rota da tela de criar vaga; duplo clique na coluna "Solicitada" abre ela */
  novaVagaHref?: string
  onMoveVaga?: (vagaId: string, status: VagaStatus) => void
  selectedVagaId?: string | null
}

/** Board só de vagas: colunas de status. Vagas em EM_TRIAGEM não aparecem
 * aqui — quem circula ali é o board Pessoas. Recusada/Encerrada/Congelada
 * viram bolinhas no canto (VagaStatusOrbs) em vez de coluna cheia. */
export function VagasBoard({
  vagas,
  draggable,
  vagaModalBase,
  novaVagaHref,
  onMoveVaga,
  selectedVagaId,
}: VagasBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openStatus, setOpenStatus] = useState<VagaStatus | null>(null)
  const handleWheel = useHorizontalWheel()
  const navigate = useNavigate()

  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null

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
    if (STATUS_ORBS.includes(destino)) setOpenStatus(destino)
  }

  const board = (
    <div
      className="scrollbar-thin flex h-full gap-9 overflow-x-auto p-5"
      onWheel={handleWheel}
    >
      {FLUXO_STATUSES.map((status) => (
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
          selectedVagaId={selectedVagaId}
        />
      ))}
    </div>
  )

  return (
    <div className="relative h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
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
        <VagaStatusOrbs
          vagas={vagas}
          draggable={draggable}
          vagaModalBase={vagaModalBase}
          activeVaga={activeVaga}
          selectedVagaId={selectedVagaId}
          openStatus={openStatus}
          onToggle={(status) => setOpenStatus((prev) => (prev === status ? null : status))}
        />
      </DndContext>
    </div>
  )
}
