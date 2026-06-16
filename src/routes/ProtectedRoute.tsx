import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { PermissionCode } from '@/types'

interface ProtectedRouteProps {
  permission?: PermissionCode
  anyPermission?: PermissionCode[]
}

export function ProtectedRoute({ permission, anyPermission }: ProtectedRouteProps) {
  const { user, hasPermission } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  if (anyPermission && !anyPermission.some((code) => hasPermission(code))) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
