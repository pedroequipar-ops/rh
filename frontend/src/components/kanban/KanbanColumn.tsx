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

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 transition',
        etapa.is_saida_negativa ? 'border-red-200' : 'border-slate-200',
        isOver && !aceitaVaga && 'ring-2 ring-slate-400',
        aceitaVaga && !cadastroAqui && 'ring-1 ring-sky-300',
        aceitaVaga && cadastroAqui && 'ring-1 ring-emerald-300',
        aceitaVaga && isOver && (cadastroAqui ? 'ring-2 ring-emerald-400' : 'ring-2 ring-sky-400'),
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
            'flex items-center gap-1.5 text-sm font-semibold',
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
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
          {candidatos.length}
        </span>
      </div>
      <div data-kanban-scrollable className="scrollbar-thin flex-1 overflow-y-auto p-2">
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
