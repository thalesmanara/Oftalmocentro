import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Permission } from '@/types'

interface ProtectedRouteProps {
  permission?: Permission
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { user, hasPermission } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
