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
import type { Candidato, EtapaKanban, Vaga, VagaStatus } from '../../types'
import { useToast } from '../../context/ToastContext'
import { LixeiraDock } from '../board/LixeiraDock'
import { etapaSaidaNegativa, ordenarEtapas } from './etapaNav'
import { useHorizontalWheel } from './useHorizontalWheel'
import { CandidatoCardContent } from './CandidatoCard'
import { KanbanColumn } from './KanbanColumn'
import { VagaAvancarDock } from './VagaAvancarDock'
import { VagaKanbanCardContent } from './VagaKanbanCard'

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
  /** Presente só na aba Triagem: liga os docks de arrastar "Avançar"
   * (→ abre cadastro completo) e a lixeira (→ Cancelada). */
  onTransicionarVaga?: (vagaId: string, status: VagaStatus) => void
  /** Primeira etapa que exige cadastro completo (ex.: Perfil Comportamental)
   * — é pra ela que o dock "Avançar" manda a vaga na aba Triagem. */
  etapaCadastroInicial?: EtapaKanban | null
  selectedVagaId?: string | null
}

/** Board só de pessoas: colunas de etapa. Vagas EM_TRIAGEM aparecem como card
 * na coluna de `etapa_atual` (pré-cadastro). Avançar candidato é só arrastar
 * pra coluna seguinte — todas as etapas de avanço já aparecem no board, sem
 * precisar de dock. A etapa de saída negativa (Lixeira) não vira coluna cheia
 * — some da lista de `colunas`; descartar um candidato é arrastar pra cima do
 * LixeiraDock (bolinha no canto inferior direito, só aparece arrastando). Na
 * aba Triagem, o mesmo LixeiraDock também aceita o card de vaga (→ Cancelada)
 * — sem menu ⋮ aqui, mesmo raciocínio de Pessoas. Só a última coluna
 * pré-cadastro (a que fica antes de exigir cadastro completo, ex.: Primeira
 * Entrevista) também ganha o dock "Avançar", que abre o cadastro completo do
 * candidato direto (`etapaCadastroInicial`) — nas colunas anteriores (ex.:
 * Triagem) só a lixeira aparece. */
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
  etapaCadastroInicial,
  selectedVagaId,
}: PessoasBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const handleWheel = useHorizontalWheel()
  const { showToast } = useToast()

  const sortedEtapas = ordenarEtapas(etapas)
  const colunas = sortedEtapas.filter((e) => !e.is_saida_negativa)
  const activeVagaId = activeId?.startsWith('vaga:') ? activeId.slice(5) : null
  const activeVaga = activeVagaId ? vagas.find((v) => v.id === activeVagaId) ?? null : null
  const activeCandidato =
    activeId && !activeVagaId ? candidatos.find((c) => c.id === activeId) ?? null : null
  const vagaEmTriagem = activeVaga?.status === 'EM_TRIAGEM'
  const saida = etapaSaidaNegativa(etapas)
  /** Última coluna pré-cadastro (ex.: Primeira Entrevista) — só arrastando
   * dela pro dock "Avançar" abre o cadastro completo. Nas colunas anteriores
   * (ex.: Triagem) o card só tem a lixeira, sem avançar por dock. */
  const ultimaEtapaPreCadastro = colunas.length > 0 ? colunas[colunas.length - 1] : null
  const podeAvancarParaCadastro =
    vagaEmTriagem &&
    !!ultimaEtapaPreCadastro &&
    activeVaga?.etapa_atual?.id === ultimaEtapaPreCadastro.id

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
      if (overIdStr === 'acao:cadastro') {
        if (etapaCadastroInicial) {
          onRegistrarCandidato?.(vaga, etapaCadastroInicial)
        }
        return
      }
      if (overIdStr === 'acao:lixeira') {
        if (vaga.transicoes_disponiveis.includes('CANCELADA')) {
          onTransicionarVaga?.(vagaId, 'CANCELADA')
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

    if (overIdStr === 'acao:lixeira') {
      if (!saida) {
        showToast('Nenhuma etapa de saída configurada', 'error')
        return
      }
      if (candidato.etapa_atual.id === saida.id) return
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
      {colunas.map((etapa) => (
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
            <div className="w-[244px] origin-top-left scale-[1.02] rounded-lg border border-slate-200 bg-white p-2 opacity-95 shadow-md">
              <VagaKanbanCardContent vaga={activeVaga} />
            </div>
          )}
          {activeCandidato && (
            <div className="w-[244px] origin-top-left scale-[1.02] rounded-lg border border-slate-200 bg-white p-2 opacity-95 shadow-md">
              <CandidatoCardContent candidato={activeCandidato} />
            </div>
          )}
        </DragOverlay>
        <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex items-center gap-3">
          <LixeiraDock bare visivel={(!!activeCandidato && !!saida) || vagaEmTriagem} />
          {onTransicionarVaga && (
            <VagaAvancarDock bare visivel={podeAvancarParaCadastro} id="acao:cadastro" />
          )}
        </div>
      </DndContext>
    </div>
  )
}
