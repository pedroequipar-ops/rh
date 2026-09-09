import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Bell, Flame, Users } from 'lucide-react'
import clsx from 'clsx'
import type { Vaga } from '../../types'
import { PRIORIDADE_META } from '../../constants/vagaStatus'

export function VagaKanbanCardContent({ vaga }: { vaga: Vaga }) {
  const prioridade = PRIORIDADE_META[vaga.prioridade]
  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-800">{vaga.titulo}</p>
      <p className="text-xs text-slate-500">{vaga.setor.nome}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {vaga.urgente && (
          <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
            <Flame size={11} /> Urgente
          </span>
        )}
        {vaga.prioridade === 3 && !vaga.urgente && (
          <span className={clsx('rounded border px-1.5 py-0.5 text-[11px] font-medium', prioridade.badge)}>
            {prioridade.label}
          </span>
        )}
        {vaga.atrasada && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
            <AlarmClock size={11} /> Atrasada
          </span>
        )}
        {vaga.status === 'EM_TRIAGEM' ? (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
            <Users size={11} /> {vaga.qtd_pessoas_fase} na fase
          </span>
        ) : (
          vaga.total_candidatos > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
              <Users size={11} /> {vaga.total_candidatos}
            </span>
          )
        )}
        {vaga.total_cobrancas > 0 && (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
            <Bell size={11} /> {vaga.total_cobrancas}
          </span>
        )}
      </div>
    </>
  )
}

interface VagaKanbanCardProps {
  vaga: Vaga
  draggable: boolean
  vagaModalBase: string
}

export function VagaKanbanCard({ vaga, draggable, vagaModalBase }: VagaKanbanCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `vaga:${vaga.id}`,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      onClick={() => navigate(`${vagaModalBase}/${vaga.id}`)}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={clsx(
        'mb-3 cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60',
      )}
    >
      <VagaKanbanCardContent vaga={vaga} />
    </div>
  )
}
