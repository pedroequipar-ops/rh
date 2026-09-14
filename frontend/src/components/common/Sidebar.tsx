import { useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { SidebarNav } from './SidebarNav'
import { NotificacoesMenu } from './NotificacoesMenu'
import { UserMenu } from './UserMenu'
import { cn } from '../ui/cn'

const COLLAPSE_KEY = 'sidebar:collapsed'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { me } = useAuth()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  if (!me) return null

  const content = (
    <>
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-blue-600 text-[13px] font-bold text-white">
          RH
        </div>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-slate-800">Recrutamento</span>
        )}
      </div>

      <SidebarNav collapsed={collapsed} onNavigate={onCloseMobile} />

      <div className="flex-1" />

      <div className="flex flex-col gap-0.5 border-t border-slate-100 p-2">
        <NotificacoesMenu collapsed={collapsed} />
        <UserMenu collapsed={collapsed} />
      </div>
    </>
  )

  return (
    <>
      <aside
        className={cn(
          'relative hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-fast md:flex',
          collapsed ? 'w-16' : 'w-52',
        )}
      >
        {content}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm outline-none transition-fast hover:bg-slate-50 hover:text-slate-600 focus-visible:bg-slate-50 focus-visible:text-slate-600 md:flex"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
