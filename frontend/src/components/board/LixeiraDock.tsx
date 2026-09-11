import { useDroppable } from '@dnd-kit/core'
import { Trash2 } from 'lucide-react'
import clsx from 'clsx'

interface LixeiraDockProps {
  visivel: boolean
}

/** Bolinha vermelha no canto inferior direito — arrasta o card pra cima dela
 * pra descartar (candidato: vai pra etapa de saída negativa). Só aparece
 * enquanto algo está sendo arrastado. */
export function LixeiraDock({ visivel }: LixeiraDockProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'acao:lixeira' })
  if (!visivel) return null
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-30">
      <div
        ref={setNodeRef}
        className={clsx(
          'pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-white shadow-lg transition-fast',
          isOver ? 'scale-110 border-red-600 bg-red-600' : 'border-red-500 bg-red-500',
        )}
      >
        <Trash2 size={22} />
      </div>
    </div>
  )
}
