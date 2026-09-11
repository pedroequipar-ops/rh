import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { VAGA_STATUS_META } from '../../constants/vagaStatus'
import { Popover } from '../ui/Popover'
import { VagaKanbanCard } from './VagaKanbanCard'

interface VagaStatusChipProps {
  status: VagaStatus
  vagas: Vaga[]
  draggable: boolean
  vagaModalBase: string
  activeVaga: Vaga | null
  selectedVagaId?: string | null
  openStatus: VagaStatus | null
  onToggle: (status: VagaStatus) => void
}

/** Chip de status de baixo volume (recusada, encerrada, congelada), grudado
 * embaixo da coluna cheia de onde essa transição normalmente parte — ponto
 * colorido + nome deixam claro o que é, ainda aceita arraste (mesmo id de
 * droppable `status:*`), só não ocupa uma coluna inteira. Fica invisível por
 * padrão (só a região ocupa espaço) e só aparece ao passar o mouse por cima
 * dela, ao arrastar uma vaga (pra servir de alvo), ou com a lista aberta
 * depois de um drop — assim dá pra arrastar uma vaga de volta pra fora sem
 * poluir o board quando não está em uso. */
export function VagaStatusChip({
  status,
  vagas,
  draggable,
  vagaModalBase,
  activeVaga,
  selectedVagaId,
  openStatus,
  onToggle,
}: VagaStatusChipProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  // A lista aberta do popover fica visualmente por cima da coluna vizinha
  // (o painel abre pra cima) — sem isso, largar um card ali cai na coluna
  // por baixo em vez de voltar pro mesmo status. Mesmo status, id à parte.
  const { setNodeRef: setListaNodeRef } = useDroppable({ id: `status:${status}:lista` })
  const [hover, setHover] = useState(false)
  const meta = VAGA_STATUS_META[status]
  const vagasDoStatus = vagas.filter((v) => v.status === status)
  const aceitaDrop = !!activeVaga && activeVaga.transicoes_disponiveis.includes(status)
  const dropInvalido = !!activeVaga && !aceitaDrop && activeVaga.status !== status
  const open = hover || openStatus === status
  const visivel = open || !!activeVaga

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={clsx('transition-opacity duration-150', visivel ? 'opacity-100' : 'opacity-0')}
    >
      <Popover
        open={open}
        onClose={() => onToggle(status)}
        side="top"
        align="start"
        trigger={
          <button
            ref={setNodeRef}
            type="button"
            onClick={() => onToggle(status)}
            className={clsx(
              'flex w-full origin-bottom items-center justify-center gap-2 rounded-full border bg-white py-2 pl-3 pr-3.5 shadow-md transition-fast',
              'border-slate-200 hover:border-slate-300',
              aceitaDrop && 'border-sky-300 ring-2 ring-sky-200',
              aceitaDrop && isOver && 'scale-110 border-sky-400 bg-sky-50 shadow-lg ring-2 ring-sky-400',
              dropInvalido && isOver && 'scale-105 border-red-300 ring-2 ring-red-300',
            )}
          >
            {status === 'ENCERRADA' ? (
              <Trash2 size={14} className="shrink-0 text-slate-500" />
            ) : (
              <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} />
            )}
            <span className="text-xs font-medium text-slate-700">{meta.label}</span>
            {vagasDoStatus.length > 0 && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 px-1 text-[9px] font-semibold text-white">
                {vagasDoStatus.length}
              </span>
            )}
          </button>
        }
      >
        <div ref={setListaNodeRef} className="max-h-72 w-64 overflow-y-auto p-2">
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-500">
            {status === 'ENCERRADA' && <Trash2 size={13} />}
            {meta.label}
          </p>
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
                pill
              />
            ))}
          </div>
        </div>
      </Popover>
    </div>
  )
}
