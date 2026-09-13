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
import { Ban } from 'lucide-react'
import type { Vaga, VagaStatus } from '../../types'
import { FLUXO_STATUSES } from '../../constants/vagaStatus'
import { Avatar } from '../ui/Avatar'
import { useHorizontalWheel } from './useHorizontalWheel'
import { MotivoDialog } from './MotivoDialog'
import { VagaAvancarDock } from './VagaAvancarDock'
import { VagaKanbanCardContent } from './VagaKanbanCard'
import { VagaKanbanColumn } from './VagaKanbanColumn'

/** Destino do dock "Avançar" por status de origem — a transição principal que
 * cada card mostra ao ser arrastado (à parte da coluna normal do fluxo, do
 * menu ⋮ de lixeira/cancelar, e de Publicada, que não usa o dock). */
const AVANCAR_DESTINO: Partial<Record<VagaStatus, VagaStatus>> = {
  EM_TRIAGEM: 'PREENCHIDA',
  PREENCHIDA: 'EM_TRIAGEM',
}

/** Extrai o status de um id de droppable `status:<STATUS>` (coluna/chip) ou
 * `status:<STATUS>:lista` (a lista aberta do chip também aceita drop, com o
 * mesmo status — ver VagaStatusChip), ou `avancar:<STATUS>` (dock — ver
 * VagaAvancarDock, prefixo à parte pra não colidir com o id da coluna). */
function statusDoDroppable(id: string | null): VagaStatus | null {
  if (id?.startsWith('status:')) return id.slice(7).split(':')[0] as VagaStatus
  if (id?.startsWith('avancar:')) return id.slice(8) as VagaStatus
  return null
}

/** Um alvo é compacto (chip/dock) quando é o dock de Avançar (prefixo
 * `avancar:`). Uma coluna cheia — mesmo que o status também seja alcançável
 * pelo dock, caso de PREENCHIDA — nunca é compacta: o preview arrastado deve
 * continuar do tamanho normal em cima dela. */
function ehAlvoCompacto(overId: string | null): boolean {
  return !!overId && overId.startsWith('avancar:')
}

interface VagasBoardProps {
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  /** rota da tela de criar vaga; duplo clique na coluna "Solicitada" abre ela */
  novaVagaHref?: string
  onMoveVaga?: (vagaId: string, status: VagaStatus) => void
  /** Recusar exige motivo (endpoint dedicado) — separado do onMoveVaga genérico. */
  onRecusarVaga?: (vagaId: string, motivo: string) => void
  selectedVagaId?: string | null
}

/** Board só de vagas: colunas de status. Vagas em EM_TRIAGEM não aparecem
 * aqui — quem circula ali é o board Pessoas. Recusar/Congelar ficam no menu
 * ⋮ de cada card (ver vagaAcoesRapidas.ts), não em coluna nem chip próprio. */
export function VagasBoard({
  vagas,
  draggable,
  vagaModalBase,
  novaVagaHref,
  onMoveVaga,
  onRecusarVaga,
  selectedVagaId,
}: VagasBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [recusarAlvo, setRecusarAlvo] = useState<{ vagaId: string; titulo: string } | null>(null)
  const handleWheel = useHorizontalWheel()
  const navigate = useNavigate()

  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null
  const avancarDestino = activeVaga ? AVANCAR_DESTINO[activeVaga.status] : undefined
  const sobreAlvoCompacto = ehAlvoCompacto(overId)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)
    if (!over) return
    const vagaId = String(active.id).slice(5)
    const vaga = vagas.find((v) => v.id === vagaId)
    if (!vaga) return
    const destino = statusDoDroppable(String(over.id))
    if (!destino) return
    if (vaga.status === destino) return
    if (!vaga.transicoes_disponiveis.includes(destino)) return
    onMoveVaga?.(vagaId, destino)
  }

  function handleAcaoRapida(vagaId: string, status: VagaStatus) {
    if (status === 'RECUSADA') {
      const vaga = vagas.find((v) => v.id === vagaId)
      if (vaga) setRecusarAlvo({ vagaId, titulo: vaga.titulo })
      return
    }
    onMoveVaga?.(vagaId, status)
  }

  const board = (
    <div
      className="scrollbar-thin flex h-full gap-9 overflow-x-auto p-5"
      onWheel={handleWheel}
    >
      {FLUXO_STATUSES.map((status) => (
        <div key={status} className="flex w-[244px] shrink-0 flex-col gap-2">
          <VagaKanbanColumn
            status={status}
            vagas={vagas.filter((v) => v.status === status)}
            draggable={draggable}
            vagaModalBase={vagaModalBase}
            onDoubleClick={
              status === 'SOLICITADA' && novaVagaHref ? () => navigate(novaVagaHref) : undefined
            }
            aceitaDrop={!!activeVaga && activeVaga.transicoes_disponiveis.includes(status)}
            dropInvalido={
              !!activeVaga &&
              !activeVaga.transicoes_disponiveis.includes(status) &&
              activeVaga.status !== status
            }
            selectedVagaId={selectedVagaId}
            onAcaoRapida={handleAcaoRapida}
          />
        </div>
      ))}
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
          setOverId(null)
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
          visivel={
            !!activeVaga &&
            !!avancarDestino &&
            activeVaga.transicoes_disponiveis.includes(avancarDestino)
          }
          status={avancarDestino}
        />
      </DndContext>
      {recusarAlvo && (
        <MotivoDialog
          titulo="Recusar vaga"
          pergunta={`Por que a vaga "${recusarAlvo.titulo}" está sendo recusada?`}
          contexto="Esse motivo fica no histórico da vaga."
          placeholder="Ex.: orçamento não aprovado neste trimestre"
          confirmLabel="Recusar"
          icon={Ban}
          onCancelar={() => setRecusarAlvo(null)}
          onConfirmar={(motivo) => {
            onRecusarVaga?.(recusarAlvo.vagaId, motivo)
            setRecusarAlvo(null)
          }}
        />
      )}
    </div>
  )
}
