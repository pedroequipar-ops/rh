import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../components/ui/cn'

const CONFIG_ITENS = [
  { to: '/config/etapas', label: 'Etapas' },
  { to: '/config/setores', label: 'Setores' },
  { to: '/config/usuarios', label: 'Usuários' },
  { to: '/config/empresa', label: 'Empresa' },
]

const DADOS_ITENS = [{ to: '/config/listagem', label: 'Listagem' }]

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
          <div className="mx-1 hidden h-px bg-slate-200 sm:my-2 sm:block" />
          <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:block">
            Dados
          </p>
          {DADOS_ITENS.map((item) => (
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
