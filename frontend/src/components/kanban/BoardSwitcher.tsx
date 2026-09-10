import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'

interface BoardSwitcherProps {
  vagasHref: string
  pessoasHref: string
  totalVagas: number
  totalPessoas: number
}

export function BoardSwitcher({ vagasHref, pessoasHref, totalVagas, totalPessoas }: BoardSwitcherProps) {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-fast',
      isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
    )

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      <NavLink to={vagasHref} end className={itemClass}>
        Vagas <span className="ml-1 text-xs text-slate-400">{totalVagas}</span>
      </NavLink>
      <NavLink to={pessoasHref} end className={itemClass}>
        Pessoas <span className="ml-1 text-xs text-slate-400">{totalPessoas}</span>
      </NavLink>
    </div>
  )
}
