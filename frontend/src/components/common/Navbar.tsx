import { Link, useNavigate } from 'react-router-dom'
import { LogOut, KanbanSquare, Plus, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function Navbar() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()

  if (!me) return null

  const base = me.role === 'RH' ? '/rh' : '/setor'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-slate-800">RH · Vagas</span>
        <Link to={`${base}/kanban`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <KanbanSquare size={16} />
          Kanban
        </Link>
        <Link to={`${base}/vagas/nova`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <Plus size={16} />
          Nova vaga
        </Link>
        {me.role === 'RH' && (
          <Link to="/rh/candidatos/novo" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <UserPlus size={16} />
            Novo candidato
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">
          {me.username} · {me.role === 'RH' ? 'RH' : me.setor?.nome ?? 'Setor'}
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </nav>
  )
}
