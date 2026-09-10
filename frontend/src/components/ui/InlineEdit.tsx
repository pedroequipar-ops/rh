import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from './cn'

type InlineEditType = 'text' | 'textarea' | 'number' | 'date' | 'select'

export interface InlineEditOption {
  value: string
  label: string
}

interface InlineEditProps {
  value: string
  type?: InlineEditType
  options?: InlineEditOption[]
  placeholder?: string
  display?: ReactNode
  disabled?: boolean
  className?: string
  inputClassName?: string
  onSave: (value: string) => Promise<void> | void
}

/**
 * Primitivo de edição no lugar: mostra o valor; clique abre o editor;
 * salva no blur/Enter (`onSave` async), Esc cancela, mostra pendente/erro.
 */
export function InlineEdit({
  value,
  type = 'text',
  options,
  placeholder,
  display,
  disabled,
  className,
  inputClassName,
  onSave,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function commit() {
    if (pending) return
    if (draft === value) {
      setEditing(false)
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      setError('Não foi possível salvar')
    } finally {
      setPending(false)
    }
  }

  function cancel() {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      void commit()
    }
  }

  if (!editing) {
    const valorRotulo =
      type === 'select' ? (options?.find((o) => o.value === value)?.label ?? value) : value
    return (
      <div className="group/inline flex items-start gap-1">
        <span
          className={cn(
            'min-w-0 flex-1 whitespace-pre-wrap px-1.5 py-1 text-sm text-slate-800',
            !value && !display ? 'text-slate-400' : undefined,
            className,
          )}
        >
          {display ?? (valorRotulo || placeholder || '—')}
        </span>
        {!disabled ? (
          <button
            type="button"
            title="Editar"
            aria-label="Editar"
            onClick={() => {
              setDraft(value)
              setError(null)
              setEditing(true)
            }}
            className="mt-0.5 shrink-0 rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 group-hover/inline:text-slate-400"
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>
    )
  }

  const controlClass = cn(
    'w-full rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100',
    inputClassName,
  )

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {type === 'textarea' ? (
        <textarea
          autoFocus
          value={draft}
          disabled={pending}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commit()}
          className={cn(controlClass, 'max-h-64 min-h-16 resize-y')}
        />
      ) : type === 'select' ? (
        <select
          autoFocus
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commit()}
          className={controlClass}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          value={draft}
          disabled={pending}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commit()}
          className={controlClass}
        />
      )}
      {pending ? <span className="text-xs text-slate-400">Salvando…</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
