import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { VAGA_STATUS_META } from '../../constants/vagaStatus'
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

/** Botão de status de baixo volume (recusada, encerrada, congelada), fixo no
 * rodapé da coluna cheia de onde essa transição normalmente parte. Clicar
 * expande a lista logo abaixo dele, dentro da própria coluna (cards no
 * tamanho normal, não um popover flutuando por cima) — cresce pra baixo,
 * tomando espaço da lista principal, sem sair da coluna. Ainda aceita
 * arraste (mesmo id de droppable `status:*`), só não ocupa uma coluna
 * inteira. Fica invisível por padrão (só a região ocupa espaço) e só aparece
 * ao passar o mouse por cima dela, ao arrastar uma vaga (pra servir de
 * alvo), ou com a lista aberta depois de um drop. */
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
  // A lista aberta também aceita drop, pra dar pra arrastar uma vaga de volta
  // pra fora dela. Mesmo status, id à parte.
  const { setNodeRef: setListaNodeRef } = useDroppable({ id: `status:${status}:lista` })
  const [hover, setHover] = useState(false)
  const meta = VAGA_STATUS_META[status]
  const vagasDoStatus = vagas.filter((v) => v.status === status)
  const aceitaDrop = !!activeVaga && activeVaga.transicoes_disponiveis.includes(status)
  const dropInvalido = !!activeVaga && !aceitaDrop && activeVaga.status !== status
  const open = hover || openStatus === status
  // Só aparece arrastando quando é destino válido pra essa vaga (ex.: chip
  // Recusada só some destino de Solicitada, Congelada só de Publicada) — uma
  // vaga Aprovada sendo arrastada não acende nenhum dos dois.
  const visivel = open || aceitaDrop
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openStatus !== status) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onToggle(status)
    }
    function onDown(e: MouseEvent) {
      if (!ref.current || !ref.current.contains(e.target as Node)) onToggle(status)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [openStatus, status, onToggle])

  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => onToggle(status)}
        className={clsx(
          'flex w-full items-center justify-center gap-2 rounded-md border-t bg-slate-50 py-1.5 pl-3 pr-3.5 transition-fast',
          'border-slate-200 hover:bg-slate-100',
          'transition-opacity duration-150',
          visivel ? 'opacity-100' : 'opacity-0',
          aceitaDrop && 'border-sky-300 bg-sky-50 ring-1 ring-sky-200',
          aceitaDrop && isOver && 'border-sky-400 bg-sky-100 ring-2 ring-sky-400',
          dropInvalido && isOver && 'border-red-300 bg-red-50 ring-2 ring-red-300',
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

      {open && (
        <div
          ref={setListaNodeRef}
          className="scrollbar-thin mt-2 max-h-72 space-y-1.5 overflow-y-auto"
        >
          {vagasDoStatus.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-400">Nenhuma vaga aqui.</p>
          )}
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
      )}
    </div>
  )
}
