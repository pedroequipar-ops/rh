import { useDroppable } from '@dnd-kit/core'
import { Trash2 } from 'lucide-react'
import clsx from 'clsx'

interface LixeiraDockProps {
  visivel: boolean
  /** true quando renderizada dentro do wrapper compartilhado com o
   * VagaAvancarDock (aba Triagem) — quem posiciona nesse caso é o wrapper,
   * pra elas não caírem em cima uma da outra no mesmo canto. */
  bare?: boolean
}

/** Bolinha vermelha no canto inferior direito — arrasta o card pra cima dela
 * pra descartar (candidato: vai pra etapa de saída negativa). Só aparece
 * enquanto algo está sendo arrastado. */
export function LixeiraDock({ visivel, bare }: LixeiraDockProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'acao:lixeira' })
  if (!visivel) return null
  const bolinha = (
    <div
      ref={setNodeRef}
      className={clsx(
        'pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-white shadow-lg transition-fast',
        isOver ? 'scale-110 border-red-600 bg-red-600' : 'border-red-500 bg-red-500',
      )}
    >
      <Trash2 size={22} />
    </div>
  )
  if (bare) return bolinha
  return <div className="pointer-events-none absolute bottom-5 right-5 z-30">{bolinha}</div>
}
