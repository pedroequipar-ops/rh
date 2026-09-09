import { useEffect, type ReactNode } from 'react'
import { cn } from './cn'

interface DialogProps {
  open?: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
  role?: 'dialog' | 'alertdialog'
}

export function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className,
  role = 'dialog',
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const hasHeader = Boolean(title || icon)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        role={role}
        aria-modal="true"
        className={cn('w-full max-w-sm rounded-lg bg-white p-5 shadow-xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader ? (
          <div className="flex gap-3">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {children ? <div className={hasHeader ? 'mt-4' : undefined}>{children}</div> : null}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}
