import type { PermissionCode } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

interface PermissionGuardProps {
  permission: PermissionCode
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) return <>{fallback}</>
  return <>{children}</>
}
