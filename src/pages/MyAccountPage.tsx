import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { changePassword } from '@/services/authService'
import { getPermissions } from '@/services/permissionsService'
import { ApiError } from '@/services/api'
import type { Permission } from '@/types'
import { getPermissionNameByCode } from '@/utils/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function MyAccountPage() {
  const { user, updateCurrentUser } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    void getPermissions().then(setPermissions)
  }, [])

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  const handleSave = () => {
    if (!user) return
    updateCurrentUser({ ...user, name, email })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordMessage(null)
    setPasswordSaving(true)
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Senha alterada com sucesso.')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Não foi possível alterar a senha. Tente novamente.'
      setPasswordError(message)
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!user) return null

  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword &&
    newPassword !== currentPassword &&
    !passwordSaving

  return (
    <div>
      <PageHeader title="Minha Conta" description="Dados do seu perfil" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informações pessoais">
          <div className="space-y-4">
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-sm text-slate-500">
              Setor atual: <strong>{user.sectorName}</strong>
            </p>
            {user.isMaster && (
              <Badge variant="info">Usuário master</Badge>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave}>Salvar alterações</Button>
              {saved && <span className="text-sm text-emerald-600">Salvo!</span>}
            </div>
          </div>
        </Card>

        <Card title="Suas permissões">
          <p className="mb-3 text-sm text-slate-500">
            Permissões individuais atribuídas à sua conta (somente leitura).
          </p>
          <ul className="space-y-2">
            {user.permissions.map((code) => (
              <li key={code}>
                <Badge variant="info">{getPermissionNameByCode(code, permissions)}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Alterar senha" className="lg:col-span-2">
          <div className="grid max-w-xl gap-4">
            <Input
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <p className="text-xs text-slate-500">A nova senha deve ter pelo menos 8 caracteres.</p>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordMessage && <p className="text-sm text-emerald-600">{passwordMessage}</p>}
            <div>
              <Button onClick={() => void handleChangePassword()} disabled={!canSubmitPassword}>
                {passwordSaving ? 'Alterando...' : 'Alterar senha'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
