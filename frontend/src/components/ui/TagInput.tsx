import { useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useTagsAutocomplete } from '../../api/hooks/useTags'
import { Label } from './Label'
import { Popover } from './Popover'
import { cn } from './cn'
import type { Tag } from '../../types'

interface TagInputProps {
  tags: Tag[]
  onChange: (nomes: string[]) => void
  disabled?: boolean
  className?: string
}

/** Chips de tag + campo que aceita `#tag` ou texto puro; Enter cria, backspace remove a última. */
export function TagInput({ tags, onChange, disabled, className }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: sugestoes = [] } = useTagsAutocomplete(draft)

  const nomesAtuais = tags.map((t) => t.nome)
  const sugestoesFiltradas = sugestoes.filter((s) => !nomesAtuais.includes(s.nome))

  function adicionar(nomeBruto: string) {
    const limpo = nomeBruto.trim().replace(/^#/, '')
    if (limpo) onChange([...nomesAtuais, limpo])
    setDraft('')
    setOpen(false)
  }

  function remover(nome: string) {
    onChange(nomesAtuais.filter((n) => n !== nome))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && draft.trim()) {
      e.preventDefault()
      adicionar(draft)
    } else if (e.key === 'Backspace' && !draft && nomesAtuais.length > 0) {
      remover(nomesAtuais[nomesAtuais.length - 1])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {tags.map((tag) => (
        <Label key={tag.id} color={tag.cor}>
          <span className="mr-1">{tag.nome}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => remover(tag.nome)}
              className="opacity-70 hover:opacity-100"
              aria-label={`Remover tag ${tag.nome}`}
            >
              <X size={10} />
            </button>
          )}
        </Label>
      ))}

      {!disabled && (
        <Popover
          open={open && draft.trim().length > 0 && sugestoesFiltradas.length > 0}
          onClose={() => setOpen(false)}
          trigger={
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={tags.length === 0 ? '#tag e Enter' : '+ tag'}
              className="w-24 min-w-[4.5rem] border-none bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400"
            />
          }
        >
          {sugestoesFiltradas.slice(0, 6).map((sugestao) => (
            <button
              key={sugestao.id}
              type="button"
              onClick={() => adicionar(sugestao.nome)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <span>{sugestao.nome}</span>
              <span className="text-xs text-slate-400">{sugestao.uso}</span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}
