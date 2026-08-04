import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { PermissionCode } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ProtectedRouteProps {
  permission?: PermissionCode
  anyPermission?: PermissionCode[]
}

export function ProtectedRoute({ permission, anyPermission }: ProtectedRouteProps) {
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

  const denied =
    (permission && !hasPermission(permission)) ||
    (anyPermission && !anyPermission.some((code) => hasPermission(code)))

  if (denied) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card>
          <h1 className="text-lg font-semibold text-slate-800">Acesso negado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Você não possui permissão para acessar esta área.
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
