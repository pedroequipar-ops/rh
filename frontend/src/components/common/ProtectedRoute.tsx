import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { Role } from '../../types'

interface ProtectedRouteProps {
  allowedRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Carregando...
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(me.role)) {
    const fallback = me.role === 'RH' ? '/rh/kanban' : '/setor/kanban'
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}
