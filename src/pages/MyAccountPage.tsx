import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { updateUser } from '@/services/usersService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PERMISSION_LABELS } from '@/types'
import { Badge } from '@/components/ui/Badge'

export function MyAccountPage() {
  const { user, updateCurrentUser, sectorName } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setNome(user.nome)
      setEmail(user.email)
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    const updated = await updateUser(user.id, { nome, email, senha: senha || undefined })
    if (updated) {
      updateCurrentUser(updated)
      setSenha('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (!user) return null

  return (
    <div>
      <PageHeader title="Minha Conta" description="Dados do seu perfil" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informações pessoais">
          <div className="space-y-4">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label="Nova senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Deixe em branco para não alterar"
            />
            <p className="text-sm text-slate-500">
              Setor atual: <strong>{sectorName}</strong>
            </p>
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
            {user.permissoes.map((p) => (
              <li key={p}>
                <Badge variant="info">{PERMISSION_LABELS[p]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
