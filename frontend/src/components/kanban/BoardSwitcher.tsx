import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'

interface BoardSwitcherProps {
  vagasHref: string
  triagemHref: string
  pessoasHref: string
  totalVagas: number
  totalTriagem: number
  totalPessoas: number
}

export function BoardSwitcher({
  vagasHref,
  triagemHref,
  pessoasHref,
  totalVagas,
  totalTriagem,
  totalPessoas,
}: BoardSwitcherProps) {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-fast',
      isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
    )

  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      <NavLink to={vagasHref} className={itemClass}>
        Vagas <span className="ml-1 text-xs text-slate-400">{totalVagas}</span>
      </NavLink>
      <NavLink to={triagemHref} className={itemClass}>
        Triagem <span className="ml-1 text-xs text-slate-400">{totalTriagem}</span>
      </NavLink>
      <NavLink to={pessoasHref} className={itemClass}>
        Pessoas <span className="ml-1 text-xs text-slate-400">{totalPessoas}</span>
      </NavLink>
    </div>
  )
}
