import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Candidato, EtapaKanban, Vaga } from '../../types'
import { CandidatoCard } from './CandidatoCard'
import { VagaKanbanCard } from './VagaKanbanCard'

interface KanbanColumnProps {
  etapa: EtapaKanban
  candidatos: Candidato[]
  draggable: boolean
  candidatoModalBase: string
  /** vagas em triagem cujo card está nesta etapa */
  vagasNaEtapa?: Vaga[]
  vagaModalBase?: string
  vagaDraggable?: boolean
  /** destaque quando uma vaga arrastada pode cair aqui */
  aceitaVaga?: boolean
  cadastroAqui?: boolean
}

export function KanbanColumn({
  etapa,
  candidatos,
  draggable,
  candidatoModalBase,
  vagasNaEtapa,
  vagaModalBase,
  vagaDraggable,
  aceitaVaga,
  cadastroAqui,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })
  const dot = etapa.is_saida_negativa ? 'bg-red-500' : (etapa.cor ?? 'bg-slate-400')
  const dotIsHex = dot.startsWith('#')

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg p-1 transition-fast',
        isOver && !aceitaVaga && 'bg-slate-100',
        aceitaVaga && !cadastroAqui && 'bg-sky-50/60 ring-1 ring-sky-300',
        aceitaVaga && cadastroAqui && 'bg-emerald-50/60 ring-1 ring-emerald-300',
        aceitaVaga && isOver && (cadastroAqui ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-sky-50 ring-2 ring-sky-400'),
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span
          className={clsx('h-2 w-2 shrink-0 rounded-[3px]', !dotIsHex && dot)}
          style={dotIsHex ? { backgroundColor: dot } : undefined}
        />
        <span
          className={clsx(
            'flex items-center gap-1.5 text-[13px] font-semibold',
            etapa.is_saida_negativa ? 'text-red-700' : 'text-slate-700',
          )}
        >
          {etapa.nome}
          {etapa.exige_cadastro_completo && (
            <span
              className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500"
              title="Nesta etapa cada pessoa precisa de cadastro completo"
            >
              cadastro
            </span>
          )}
        </span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {candidatos.length}
        </span>
      </div>
      <div
        data-kanban-scrollable
        className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1"
      >
        {vagasNaEtapa?.map((vaga) => (
          <VagaKanbanCard
            key={`vaga-${vaga.id}`}
            vaga={vaga}
            draggable={!!vagaDraggable}
            vagaModalBase={vagaModalBase ?? ''}
          />
        ))}
        {candidatos.map((candidato) => (
          <CandidatoCard
            key={candidato.id}
            candidato={candidato}
            draggable={draggable}
            candidatoModalBase={candidatoModalBase}
          />
        ))}
        {candidatos.length === 0 && !vagasNaEtapa?.length && (
          <p className="px-1 py-2 text-xs text-slate-400">Nenhum candidato</p>
        )}
      </div>
    </div>
  )
}
