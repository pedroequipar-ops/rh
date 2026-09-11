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
      <div className="flex h-full items-center justify-center text-slate-500">
        Carregando...
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(me.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
