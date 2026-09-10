import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { STATUS_ORBS, VAGA_STATUS_META } from '../../constants/vagaStatus'
import { Popover } from '../ui/Popover'
import { VagaKanbanCard } from './VagaKanbanCard'

interface VagaStatusOrbsProps {
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  activeVaga: Vaga | null
  selectedVagaId?: string | null
  openStatus: VagaStatus | null
  onToggle: (status: VagaStatus) => void
}

function StatusOrb({
  status,
  vagas,
  draggable,
  vagaModalBase,
  activeVaga,
  selectedVagaId,
  openStatus,
  onToggle,
}: VagaStatusOrbsProps & { status: VagaStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  const meta = VAGA_STATUS_META[status]
  const vagasDoStatus = vagas.filter((v) => v.status === status)
  const aceitaDrop = !!activeVaga && activeVaga.transicoes_disponiveis.includes(status)
  const dropInvalido = !!activeVaga && !aceitaDrop && activeVaga.status !== status

  return (
    <Popover
      open={openStatus === status}
      onClose={() => onToggle(status)}
      side="top"
      align="end"
      trigger={
        <button
          ref={setNodeRef}
          type="button"
          onClick={() => onToggle(status)}
          className={clsx(
            'flex origin-right items-center gap-2 rounded-full border bg-white py-2 pl-3 pr-3.5 shadow-md transition-fast',
            'border-slate-200 hover:border-slate-300',
            aceitaDrop && 'border-sky-300 ring-2 ring-sky-200',
            aceitaDrop && isOver && 'scale-125 border-sky-400 bg-sky-50 shadow-lg ring-2 ring-sky-400',
            dropInvalido && isOver && 'scale-110 border-red-300 ring-2 ring-red-300',
          )}
        >
          <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} />
          <span className="text-xs font-medium text-slate-700">{meta.label}</span>
          {vagasDoStatus.length > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 px-1 text-[9px] font-semibold text-white">
              {vagasDoStatus.length}
            </span>
          )}
        </button>
      }
    >
      <div className="max-h-72 w-64 overflow-y-auto p-2">
        <p className="mb-1.5 px-1 text-xs font-semibold text-slate-500">{meta.label}</p>
        {vagasDoStatus.length === 0 && (
          <p className="px-1 py-2 text-xs text-slate-400">Nenhuma vaga aqui.</p>
        )}
        <div className="space-y-1.5">
          {vagasDoStatus.map((vaga) => (
            <VagaKanbanCard
              key={vaga.id}
              vaga={vaga}
              draggable={draggable}
              vagaModalBase={vagaModalBase}
              selected={vaga.id === selectedVagaId}
            />
          ))}
        </div>
      </div>
    </Popover>
  )
}

/** Status de baixo volume (recusada, candidaturas encerradas, congelada) como
 * chips soltos no canto do board — ponto colorido + nome deixam claro o que é
 * cada um, ainda aceitam arraste, só não ocupam uma coluna cheia. `openStatus`
 * é controlado de fora pra abrir sozinho quando um card é solto ali (mesmo
 * efeito de clicar), além do clique manual. */
export function VagaStatusOrbs(props: VagaStatusOrbsProps) {
  return (
    <div className="absolute bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {STATUS_ORBS.map((status) => (
        <StatusOrb key={status} status={status} {...props} />
      ))}
    </div>
  )
}
