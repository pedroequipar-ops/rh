import type { ReactNode } from 'react'
import { cn } from './cn'

/** Etiqueta colorida estilo Trello (chip no card / no painel). */
export function Label({
  color,
  className,
  children,
}: {
  color?: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-xs font-medium',
        !color ? 'bg-slate-100 text-slate-700' : undefined,
        className,
      )}
      style={color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {children}
    </span>
  )
}
