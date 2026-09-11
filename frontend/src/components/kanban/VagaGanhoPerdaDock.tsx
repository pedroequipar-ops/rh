import { useDroppable } from '@dnd-kit/core'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'

function DockAlvo({
  status,
  label,
  tone,
  icon: Icon,
  activeVaga,
}: {
  status: VagaStatus
  label: string
  tone: 'ganho' | 'perda'
  icon: typeof ThumbsUp
  activeVaga: Vaga | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  const aceitaDrop = !!activeVaga && activeVaga.transicoes_disponiveis.includes(status)
  const dropInvalido = !!activeVaga && !aceitaDrop

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'pointer-events-auto flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-white text-sm font-semibold shadow-lg transition-fast',
        dropInvalido && 'scale-95 border-slate-200 text-slate-300 opacity-60',
        !dropInvalido && tone === 'ganho' && (isOver ? 'scale-110 border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-300 text-emerald-600'),
        !dropInvalido && tone === 'perda' && (isOver ? 'scale-110 border-red-500 bg-red-500 text-white' : 'border-red-300 text-red-600'),
      )}
    >
      <Icon size={28} />
      {label}
    </div>
  )
}

interface VagaGanhoPerdaDockProps {
  visivel: boolean
  activeVaga: Vaga | null
}

/** Dois alvos grandes de drop no canto inferior direito do board Vagas — só
 * aparecem enquanto uma vaga está sendo arrastada. Ganho fecha a vaga como
 * Preenchida; Perda cancela. Fica esmaecido quando a vaga arrastada não pode
 * ir pra aquele status (ex.: Ganho só vale a partir de "Em triagem"). */
export function VagaGanhoPerdaDock({ visivel, activeVaga }: VagaGanhoPerdaDockProps) {
  if (!visivel) return null
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex gap-3">
      <DockAlvo status="PREENCHIDA" label="Ganho" tone="ganho" icon={ThumbsUp} activeVaga={activeVaga} />
      <DockAlvo status="CANCELADA" label="Perda" tone="perda" icon={ThumbsDown} activeVaga={activeVaga} />
    </div>
  )
}
