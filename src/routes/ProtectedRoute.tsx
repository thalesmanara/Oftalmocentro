import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { PermissionCode } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { canAccessTechnicalAdministration } from '@/utils/permissions'

interface ProtectedRouteProps {
  permission?: PermissionCode
  anyPermission?: PermissionCode[]
  /** Exige Master ou Administrador Técnico (não é bypass geral de permissões). */
  requireTechnicalAdmin?: boolean
}

export function ProtectedRoute({
  permission,
  anyPermission,
  requireTechnicalAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useAuth()

  if (loading) {
    return (
      <p className="p-6 text-slate-500" role="status" aria-live="polite">
        Carregando sessão...
      </p>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const technicalDenied =
    requireTechnicalAdmin && !canAccessTechnicalAdministration(user)

  const permissionDenied =
    (permission && !hasPermission(permission)) ||
    (anyPermission && !anyPermission.some((code) => hasPermission(code)))

  if (technicalDenied || permissionDenied) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card>
          <h1 className="text-lg font-semibold text-slate-800">Acesso negado</h1>
          <p className="mt-2 text-sm text-slate-600">
            {technicalDenied
              ? 'Esta área é restrita a Administrador Técnico ou Master.'
              : 'Você não possui permissão para acessar esta área.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.history.back()}>
              Voltar
            </Button>
            <Link to="/dashboard">
              <Button>Ir ao Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
