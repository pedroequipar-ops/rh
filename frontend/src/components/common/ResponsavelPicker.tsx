import { useState } from 'react'
import { UserCircle2, X } from 'lucide-react'
import { Popover } from '../ui/Popover'
import { Avatar } from '../ui/Avatar'
import type { UsuarioResumo } from '../../types'

function nomeExibicao(u: UsuarioResumo): string {
  const nome = [u.first_name, u.last_name].filter(Boolean).join(' ')
  return nome || u.username
}

interface ResponsavelPickerProps {
  value: UsuarioResumo | null
  usuarios: UsuarioResumo[]
  onChange: (usuarioId: string | null) => void
  disabled?: boolean
}

/** Popover com Avatar + lista de usuários — usado no header dos painéis de
 * vaga/candidato e como coluna nas tabelas (Fase 8). */
export function ResponsavelPicker({ value, usuarios, onChange, disabled }: ResponsavelPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="w-56 p-1"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-fast hover:bg-slate-50 disabled:opacity-50"
        >
          {value ? (
            <>
              <Avatar name={nomeExibicao(value)} size="sm" />
              {nomeExibicao(value)}
            </>
          ) : (
            <>
              <UserCircle2 size={14} className="text-slate-400" />
              Sem responsável
            </>
          )}
        </button>
      }
    >
      {value && (
        <button
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50"
        >
          <X size={14} /> Remover responsável
        </button>
      )}
      {usuarios.map((u) => (
        <button
          key={u.id}
          onClick={() => {
            onChange(u.id)
            setOpen(false)
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          <Avatar name={nomeExibicao(u)} size="sm" />
          {nomeExibicao(u)}
        </button>
      ))}
      {usuarios.length === 0 && (
        <p className="px-2 py-1.5 text-xs text-slate-400">Nenhum usuário disponível.</p>
      )}
    </Popover>
  )
}
