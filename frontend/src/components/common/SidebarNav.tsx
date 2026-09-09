import { KanbanSquare, List, Plus, UserPlus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ButtonLink } from '../ui/Button'
import { cn } from '../ui/cn'

interface SidebarNavProps {
  collapsed: boolean
  onNavigate: () => void
}

export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  const { me } = useAuth()
  if (!me) return null
  const isRh = me.role === 'RH'
  const base = isRh ? '/rh' : '/setor'

  const items = [
    { to: `${base}/kanban`, label: 'Kanban', icon: KanbanSquare },
    { to: `${base}/listagem`, label: 'Listagem', icon: List },
  ]

  return (
    <nav className="flex flex-col gap-2 overflow-y-auto px-2 py-3">
      <div className="flex flex-col gap-0.5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-fast',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-blue-50 font-semibold text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r bg-blue-600" />
                )}
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="my-1 h-px bg-slate-100" />

      <div className="flex flex-col gap-1.5">
        <ButtonLink
          to={`${base}/vagas/nova`}
          onClick={onNavigate}
          size="sm"
          title={collapsed ? 'Nova vaga' : undefined}
          className={cn('w-full', collapsed && 'px-0')}
        >
          <Plus size={15} />
          {!collapsed && 'Nova vaga'}
        </ButtonLink>
        {isRh && (
          <ButtonLink
            to="/rh/candidatos/novo"
            onClick={onNavigate}
            variant="secondary"
            size="sm"
            title={collapsed ? 'Novo candidato' : undefined}
            className={cn('w-full', collapsed && 'px-0')}
          >
            <UserPlus size={15} />
            {!collapsed && 'Novo candidato'}
          </ButtonLink>
        )}
      </div>
    </nav>
  )
}
