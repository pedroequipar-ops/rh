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
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { CHIP_ABAIXO_DA_COLUNA, FLUXO_STATUSES, STATUS_ORBS } from '../../constants/vagaStatus'
import { Avatar } from '../ui/Avatar'
import { useHorizontalWheel } from './useHorizontalWheel'
import { VagaAvancarDock } from './VagaAvancarDock'
import { VagaKanbanCardContent } from './VagaKanbanCard'
import { VagaKanbanColumn } from './VagaKanbanColumn'
import { VagaStatusChip } from './VagaStatusChip'

/** Alvos de drop compactos (chips/dock) que não são coluna — o preview
 * arrastado encolhe pra um chip pequeno em cima deles. */
const ALVOS_COMPACTOS: VagaStatus[] = [...STATUS_ORBS, 'PREENCHIDA']

/** Extrai o status de um id de droppable `status:<STATUS>` (coluna/chip) ou
 * `status:<STATUS>:lista` (a lista aberta do chip também aceita drop, com o
 * mesmo status — ver VagaStatusChip), ou `avancar:<STATUS>` (dock — ver
 * VagaAvancarDock, prefixo à parte pra não colidir com o id da coluna). */
function statusDoDroppable(id: string | null): VagaStatus | null {
  if (id?.startsWith('status:')) return id.slice(7).split(':')[0] as VagaStatus
  if (id?.startsWith('avancar:')) return id.slice(8) as VagaStatus
  return null
}

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
 * aqui — quem circula ali é o board Pessoas. Recusada/Congelada viram um
 * chip embaixo da coluna de onde normalmente partem (Solicitada/Publicada)
 * em vez de coluna cheia própria; passar o mouse por cima abre a lista (pra
 * dar pra arrastar uma vaga de volta pra fora de lá). */
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
  const [overStatus, setOverStatus] = useState<VagaStatus | null>(null)
  const [openStatus, setOpenStatus] = useState<VagaStatus | null>(null)
  const handleWheel = useHorizontalWheel()
  const navigate = useNavigate()

  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null
  const sobreAlvoCompacto = !!overStatus && ALVOS_COMPACTOS.includes(overStatus)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    setOverStatus(statusDoDroppable(event.over ? String(event.over.id) : null))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverStatus(null)
    if (!over) return
    const vagaId = String(active.id).slice(5)
    const vaga = vagas.find((v) => v.id === vagaId)
    if (!vaga) return
    const destino = statusDoDroppable(String(over.id))
    if (!destino) return
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
      {FLUXO_STATUSES.map((status) => {
        const chipStatus = CHIP_ABAIXO_DA_COLUNA[status]
        return (
          <div key={status} className="flex w-[244px] shrink-0 flex-col gap-2">
            <VagaKanbanColumn
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
              onAcaoRapida={onMoveVaga}
            />
            {chipStatus && (
              <VagaStatusChip
                status={chipStatus}
                vagas={vagas}
                draggable={draggable}
                vagaModalBase={vagaModalBase}
                activeVaga={activeVaga}
                selectedVagaId={selectedVagaId}
                openStatus={openStatus}
                onToggle={(s) => setOpenStatus((prev) => (prev === s ? null : s))}
              />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="relative h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setOverStatus(null)
        }}
      >
        {board}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
          {activeVaga && (
            <div className="relative">
              <div
                className={clsx(
                  'w-[244px] origin-top-left rounded-lg border border-slate-200 bg-white p-2 opacity-95 shadow-md transition-all duration-200 ease-out',
                  sobreAlvoCompacto ? 'scale-0 opacity-0' : 'scale-[1.02] opacity-100',
                )}
              >
                <VagaKanbanCardContent vaga={activeVaga} />
              </div>
              <div
                className={clsx(
                  'absolute left-0 top-0 flex w-fit origin-top-left items-center gap-2 rounded-full border border-sky-300 bg-sky-50 py-2 pl-2 pr-3.5 shadow-lg transition-all duration-200 ease-out',
                  sobreAlvoCompacto ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
                )}
              >
                <Avatar name={activeVaga.setor.nome} size="xs" />
                <span className="max-w-40 truncate text-xs font-medium text-slate-800">
                  {activeVaga.titulo}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
        <VagaAvancarDock
          visivel={!!activeVaga && activeVaga.transicoes_disponiveis.includes('PREENCHIDA')}
          status="PREENCHIDA"
        />
      </DndContext>
    </div>
  )
}
