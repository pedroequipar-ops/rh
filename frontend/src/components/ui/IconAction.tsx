import type { ComponentType } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow disabled:bg-blue-300',
  secondary:
    'border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 hover:shadow disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow disabled:opacity-50',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow disabled:opacity-50',
}

interface IconActionProps {
  icon: ComponentType<{ size?: number }>
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: Variant
  type?: 'button' | 'submit'
}

/** Botão de ação compacto: só o ícone por padrão, o próprio quadrado estica
 * pra mostrar o nome completo ao passar o mouse (ou focar) — pra caber várias
 * ações numa linha só, sem virar uma parede de botões de texto. Cresce no
 * fluxo normal (empurra o próximo botão pra direita, não cobre ele por cima
 * -- cobrir foi tentado antes e ficava estranho). `delay-0` no grupo hover
 * vs. `delay-75` fora dele: expande na hora, encolhe com um pequeno atraso —
 * suaviza o "salto" de quem tá tentando alcançar o próximo botão logo depois
 * deste. */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'secondary',
  type = 'button',
}: IconActionProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'group flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-lg px-2.5',
        'transition-all duration-200 delay-75 ease-out hover:scale-[1.04] active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
        'disabled:cursor-not-allowed disabled:hover:scale-100',
        VARIANTS[variant],
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span
        className={cn(
          'max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0',
          'transition-all duration-200 delay-75 ease-out',
          'group-hover:ml-1.5 group-hover:max-w-[10rem] group-hover:opacity-100 group-hover:delay-0',
          'group-focus-visible:ml-1.5 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100 group-focus-visible:delay-0',
        )}
      >
        {label}
      </span>
    </button>
  )
}
