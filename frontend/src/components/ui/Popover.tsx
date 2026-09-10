import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './cn'

interface PopoverProps {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  align?: 'start' | 'end'
  /** lado onde o painel abre em relação ao trigger; 'top' pra quando o trigger fica colado no rodapé */
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}

/** Popover ancorado ao trigger; click-fora e Esc fecham. */
export function Popover({
  open,
  onClose,
  trigger,
  align = 'start',
  side = 'bottom',
  className,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onDown(e: MouseEvent) {
      if (!ref.current || !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger}
      {open ? (
        <div
          className={cn(
            'absolute z-50 min-w-48 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
