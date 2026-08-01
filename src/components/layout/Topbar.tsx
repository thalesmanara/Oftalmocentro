import { Link } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/Button'

export function Topbar() {
  const { user, logout } = useAuth()
  const { settings } = useSettings()

  return (
    <header className="fixed left-64 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-800">{settings.clinicName}</p>
        <p className="text-xs text-slate-500">{settings.systemName}</p>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.sectorName}</p>
        </div>
        <Link
          to="/minha-conta"
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
        >
          <User size={16} />
          Minha Conta
        </Link>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut size={16} />
          Sair
        </Button>
      </div>
    </header>
  )
}
