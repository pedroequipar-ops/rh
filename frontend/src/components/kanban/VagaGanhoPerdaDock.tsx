import { useDroppable } from '@dnd-kit/core'
import { ArrowRightCircle, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { VagaStatus } from '../../types'

function DockAlvo({
  status,
  label,
  tone,
  icon: Icon,
}: {
  status: VagaStatus
  label: string
  tone: 'avancar' | 'lixeira'
  icon: typeof ArrowRightCircle
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'pointer-events-auto flex h-16 w-40 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold text-white shadow-lg transition-fast',
        tone === 'avancar' && (isOver ? 'scale-110 border-emerald-600 bg-emerald-600' : 'border-emerald-500 bg-emerald-500'),
        tone === 'lixeira' && (isOver ? 'scale-110 border-red-600 bg-red-600' : 'border-red-500 bg-red-500'),
      )}
    >
      <Icon size={20} />
      {label}
    </div>
  )
}

interface VagaGanhoPerdaDockProps {
  visivel: boolean
}

/** Dois alvos grandes de drop no canto inferior direito do board Vagas — só
 * aparecem enquanto uma vaga está sendo arrastada. Avançar fecha a vaga como
 * Preenchida; Lixeira encerra (some do board, exclusão automática em 12h).
 * Sempre coloridos — se a vaga arrastada não puder ir pra aquele status, o
 * drop simplesmente não faz nada (ver `handleDragEnd` em VagasBoard). */
export function VagaGanhoPerdaDock({ visivel }: VagaGanhoPerdaDockProps) {
  if (!visivel) return null
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex gap-3">
      <DockAlvo status="ENCERRADA" label="Lixeira" tone="lixeira" icon={Trash2} />
      <DockAlvo status="PREENCHIDA" label="Avançar" tone="avancar" icon={ArrowRightCircle} />
    </div>
  )
}
