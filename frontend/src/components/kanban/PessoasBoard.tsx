import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ArrowRightCircle, XCircle } from 'lucide-react'
import type { Candidato, EtapaKanban, Vaga, VagaStatus } from '../../types'
import { useToast } from '../../context/ToastContext'
import { QuickActionDock } from '../board/QuickActionDock'
import { etapaSaidaNegativa, ordenarEtapas, proximaEtapa } from './etapaNav'
import { useHorizontalWheel } from './useHorizontalWheel'
import { CandidatoCardContent } from './CandidatoCard'
import { KanbanColumn } from './KanbanColumn'
import { VagaGanhoPerdaDock, type DockAlvoConfig } from './VagaGanhoPerdaDock'
import { VagaKanbanCardContent } from './VagaKanbanCard'

/** Só aparece na aba Triagem (onTransicionarVaga presente): EM_TRIAGEM só
 * chega a Preenchida ou Cancelada dali (ver TRANSICOES no backend). */
const DOCK_ALVOS: DockAlvoConfig[] = [
  { status: 'CANCELADA', label: 'Cancelar', tone: 'lixeira', icon: XCircle },
  { status: 'PREENCHIDA', label: 'Avançar', tone: 'avancar', icon: ArrowRightCircle },
]

interface PessoasBoardProps {
  etapas: EtapaKanban[]
  candidatos: Candidato[]
  vagas: Vaga[]
  draggable: boolean
  candidatoModalBase: string
  vagaModalBase: string
  onMoveCandidato?: (candidatoId: string, etapaId: string) => void
  onMoveVagaEtapa?: (vagaId: string, etapaId: string) => void
  onRegistrarCandidato?: (vaga: Vaga, etapa: EtapaKanban) => void
  /** Presente só na aba Triagem: liga o dock Avançar/Cancelar pra vaga arrastada. */
  onTransicionarVaga?: (vagaId: string, status: VagaStatus) => void
  selectedVagaId?: string | null
}

/** Board só de pessoas: colunas de etapa. Vagas EM_TRIAGEM aparecem como card
 * na coluna de `etapa_atual` (pré-cadastro); hospeda o QuickActionDock. */
export function PessoasBoard({
  etapas,
  candidatos,
  vagas,
  draggable,
  candidatoModalBase,
  vagaModalBase,
  onMoveCandidato,
  onMoveVagaEtapa,
  onRegistrarCandidato,
  onTransicionarVaga,
  selectedVagaId,
}: PessoasBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const handleWheel = useHorizontalWheel()
  const { showToast } = useToast()

  const sortedEtapas = ordenarEtapas(etapas)
  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null
  const activeCandidato =
    activeId && !activeVagaId ? candidatos.find((c) => c.id === activeId) ?? null : null
  const vagaEmTriagem = activeVaga?.status === 'EM_TRIAGEM'
  const saida = etapaSaidaNegativa(etapas)

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
      const vagaId = activeIdStr.slice(5)
      const vaga = vagas.find((v) => v.id === vagaId)
      if (!vaga || vaga.status !== 'EM_TRIAGEM') return
      if (overIdStr.startsWith('status:')) {
        const destino = overIdStr.slice(7) as VagaStatus
        if (vaga.transicoes_disponiveis.includes(destino)) {
          onTransicionarVaga?.(vagaId, destino)
        }
        return
      }
      const etapa = etapas.find((e) => e.id === overIdStr)
      if (!etapa || etapa.is_saida_negativa) return
      if (etapa.exige_cadastro_completo) {
        onRegistrarCandidato?.(vaga, etapa)
      } else if (vaga.etapa_atual?.id !== etapa.id) {
        onMoveVagaEtapa?.(vagaId, etapa.id)
      }
      return
    }

    const candidato = candidatos.find((c) => c.id === activeIdStr)
    if (!candidato) return

    if (overIdStr === 'acao:ganho') {
      const destino = proximaEtapa(candidato, etapas)
      if (!destino) {
        showToast('Não há próxima etapa pra avançar', 'error')
        return
      }
      onMoveCandidato?.(activeIdStr, destino.id)
      return
    }

    if (overIdStr === 'acao:perda') {
      if (!saida) {
        showToast('Nenhuma etapa de saída configurada', 'error')
        return
      }
      if (candidato.etapa_atual.id === saida.id) {
        showToast('Candidato já está na saída', 'error')
        return
      }
      onMoveCandidato?.(activeIdStr, saida.id)
      return
    }

    if (candidato.etapa_atual.id === overIdStr) return
    onMoveCandidato?.(activeIdStr, overIdStr)
  }

  const board = (
    <div
      className="scrollbar-thin flex h-full gap-9 overflow-x-auto p-5"
      onWheel={handleWheel}
    >
      {sortedEtapas.map((etapa) => (
        <KanbanColumn
          key={etapa.id}
          etapa={etapa}
          candidatos={candidatos.filter((c) => c.etapa_atual.id === etapa.id)}
          draggable={draggable}
          candidatoModalBase={candidatoModalBase}
          vagasNaEtapa={vagas.filter(
            (v) => v.status === 'EM_TRIAGEM' && v.etapa_atual?.id === etapa.id,
          )}
          vagaModalBase={vagaModalBase}
          vagaDraggable={draggable}
          aceitaVaga={vagaEmTriagem && !etapa.is_saida_negativa}
          cadastroAqui={etapa.exige_cadastro_completo}
          selectedVagaId={selectedVagaId}
        />
      ))}
    </div>
  )

  if (!draggable) {
    return <div className="relative h-full">{board}</div>
  }

  return (
    <div className="relative h-full">
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
          {activeCandidato && (
            <div className="w-[244px] scale-[1.02] rounded-lg border border-slate-200 bg-white p-2 opacity-95 shadow-md">
              <CandidatoCardContent candidato={activeCandidato} />
            </div>
          )}
        </DragOverlay>
        <QuickActionDock visivel={!!activeCandidato} temSaidaNegativa={!!saida} />
        {onTransicionarVaga && (
          <VagaGanhoPerdaDock visivel={vagaEmTriagem} alvos={DOCK_ALVOS} />
        )}
      </DndContext>
    </div>
  )
}
