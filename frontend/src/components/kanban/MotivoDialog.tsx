import { useState, type ComponentType } from 'react'
import { X } from 'lucide-react'

interface MotivoDialogProps {
  titulo: string
  pergunta: string
  contexto?: string
  placeholder?: string
  confirmLabel: string
  icon: ComponentType<{ size?: number }>
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}

/** Diálogo genérico pra pedir um motivo obrigatório antes de uma ação
 * (recusar vaga, mover candidato pra lixeira, etc.) — botão de confirmar só
 * habilita com texto preenchido. */
export function MotivoDialog({
  titulo,
  pergunta,
  contexto,
  placeholder,
  confirmLabel,
  icon: Icon,
  onConfirmar,
  onCancelar,
}: MotivoDialogProps) {
  const [motivo, setMotivo] = useState('')
  const podeConfirmar = motivo.trim().length > 0

  function confirmar() {
    if (!podeConfirmar) return
    onConfirmar(motivo.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Icon size={14} />
            </span>
            <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          </div>
          <button
            onClick={onCancelar}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-600">{pergunta}</p>
          {contexto && <p className="mt-1 text-xs text-slate-400">{contexto}</p>}
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirmar()
              if (e.key === 'Escape') onCancelar()
            }}
            rows={3}
            placeholder={placeholder}
            className="mt-3 w-full resize-none rounded border border-slate-300 p-2 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-3">
          <button
            onClick={onCancelar}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
