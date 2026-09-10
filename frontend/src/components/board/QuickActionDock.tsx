import { useDroppable } from '@dnd-kit/core'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import clsx from 'clsx'

function DockAlvo({
  id,
  label,
  tone,
  icon: Icon,
}: {
  id: string
  label: string
  tone: 'ganho' | 'perda'
  icon: typeof ThumbsUp
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'pointer-events-auto flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-2 bg-white text-xs font-semibold shadow-lg transition-fast',
        tone === 'ganho'
          ? isOver
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-emerald-300 text-emerald-600'
          : isOver
            ? 'border-red-500 bg-red-500 text-white'
            : 'border-red-300 text-red-600',
      )}
    >
      <Icon size={18} />
      {label}
    </div>
  )
}

interface QuickActionDockProps {
  visivel: boolean
  temSaidaNegativa: boolean
}

/** Dois alvos de drop fixos no canto inferior direito do board Pessoas — só
 * aparecem enquanto um candidato está sendo arrastado. */
export function QuickActionDock({ visivel, temSaidaNegativa }: QuickActionDockProps) {
  if (!visivel) return null
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex gap-3">
      <DockAlvo id="acao:ganho" label="Ganho" tone="ganho" icon={ThumbsUp} />
      {temSaidaNegativa && <DockAlvo id="acao:perda" label="Perda" tone="perda" icon={ThumbsDown} />}
    </div>
  )
}
