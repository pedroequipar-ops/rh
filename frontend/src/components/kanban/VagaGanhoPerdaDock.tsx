import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { ComponentType } from 'react'
import type { VagaStatus } from '../../types'

export interface DockAlvoConfig {
  status: VagaStatus
  label: string
  tone: 'avancar' | 'lixeira'
  icon: ComponentType<{ size?: number }>
}

function DockAlvo({ status, label, tone, icon: Icon }: DockAlvoConfig) {
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
  alvos: DockAlvoConfig[]
}

/** Alvos grandes de drop no canto inferior direito do board — só aparecem
 * enquanto uma vaga está sendo arrastada. Cada board passa seus próprios
 * `alvos` (status alcançável dali + rótulo/cor/ícone). Sempre coloridos — se
 * a vaga arrastada não puder ir pra aquele status, o drop simplesmente não
 * faz nada (ver `handleDragEnd` de cada board). */
export function VagaGanhoPerdaDock({ visivel, alvos }: VagaGanhoPerdaDockProps) {
  if (!visivel || alvos.length === 0) return null
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30 flex gap-3">
      {alvos.map((alvo) => (
        <DockAlvo key={alvo.status} {...alvo} />
      ))}
    </div>
  )
}
