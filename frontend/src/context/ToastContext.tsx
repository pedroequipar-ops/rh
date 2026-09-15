import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning'

interface ToastActionConfig {
  actionLabel: string
  onAction: () => void
}

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastActionConfig
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, action?: ToastActionConfig) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_DURATION_MS = 3000
const TOAST_DURATION_WITH_ACTION_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', action?: ToastActionConfig) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, variant, action }])
      setTimeout(
        () => dismiss(id),
        action ? TOAST_DURATION_WITH_ACTION_MS : TOAST_DURATION_MS,
      )
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg ' +
              (toast.variant === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : toast.variant === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700')
            }
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
            ) : toast.variant === 'warning' ? (
              <AlertTriangle size={16} className="shrink-0 text-amber-500" />
            ) : (
              <XCircle size={16} className="shrink-0 text-red-500" />
            )}
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onAction()
                  dismiss(toast.id)
                }}
                className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold underline hover:bg-black/5"
              >
                {toast.action.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de ToastProvider')
  }
  return ctx
}
