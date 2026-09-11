import { useDroppable } from '@dnd-kit/core'
import { ArrowRightCircle } from 'lucide-react'
import clsx from 'clsx'
import type { VagaStatus } from '../../types'

interface VagaAvancarDockProps {
  visivel: boolean
  status: VagaStatus
  label?: string
}

/** Único alvo de drop no canto inferior direito do board — "Avançar" continua
 * arrastável porque não é destrutivo, ao contrário de Lixeira/Cancelar (esses
 * ficam só no menu ⋮ do card, que exige um segundo clique de confirmação —
 * ver vagaAcoesRapidas.ts). Se a vaga arrastada não puder ir pra esse status,
 * o drop simplesmente não faz nada.
 * Id prefixado `avancar:` (não `status:`) de propósito: quando o alvo é
 * PREENCHIDA, esse status também é uma coluna cheia do board Vagas — usar o
 * mesmo id `status:PREENCHIDA` colidiria com o droppable da coluna e o dnd-kit
 * só reconheceria um dos dois nós (drop no dock parava de funcionar). */
export function VagaAvancarDock({ visivel, status, label = 'Avançar' }: VagaAvancarDockProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `avancar:${status}` })
  if (!visivel) return null
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30">
      <div
        ref={setNodeRef}
        className={clsx(
          'pointer-events-auto flex h-16 w-40 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold text-white shadow-lg transition-fast',
          isOver
            ? 'scale-110 border-emerald-600 bg-emerald-600'
            : 'border-emerald-500 bg-emerald-500',
        )}
      >
        <ArrowRightCircle size={20} />
        {label}
      </div>
    </div>
  )
}
