import type { ReactNode } from 'react'
import { cn } from './cn'

export function EmptyState({
  icon,
  title,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}
    >
      {icon ? <div className="text-slate-300">{icon}</div> : null}
      <p className="text-sm text-slate-500">{title}</p>
      {action}
    </div>
  )
}
