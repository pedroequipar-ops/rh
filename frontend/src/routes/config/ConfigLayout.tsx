import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../components/ui/cn'

const CONFIG_ITENS = [
  { to: '/config/setores', label: 'Setores' },
  { to: '/config/candidatos', label: 'Candidatos cadastrados' },
  { to: '/config/vagas-ativas', label: 'Vagas ativas' },
]

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition',
          isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function ConfigLayout() {
  return (
    <div className="flex h-full flex-col bg-board">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-5">
        <h1 className="text-lg font-semibold text-slate-800">Configurações</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:p-6">
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-48 sm:flex-col sm:overflow-visible">
          {CONFIG_ITENS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
