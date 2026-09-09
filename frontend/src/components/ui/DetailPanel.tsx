import { useEffect, type ReactNode } from 'react'
import { cn } from './cn'

interface DetailPanelProps {
  onClose: () => void
  children: ReactNode
  className?: string
}

/**
 * Shell do painel de detalhe: overlay estreito (com backdrop) no mobile,
 * coluna fixa ao lado do board a partir de `lg`. Quem desenha header/tabs/
 * corpo rolável é o conteúdo (`VagaDetailPanel`/`CandidatoDetailPanel`).
 */
export function DetailPanel({ onClose, children, className }: DetailPanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-xl lg:static lg:z-auto lg:w-[460px] lg:shrink-0 lg:shadow-none',
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}
