import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function LoginPage() {
  const { user, login, loading } = useAuth()
  const { settings } = useSettings()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !senha) {
      setError('Informe e-mail e senha.')
      return
    }

    try {
      await login(email, senha)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Usuário ou senha inválidos.'
      )
    }
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="hidden w-1/2 flex-col justify-center px-16 text-white lg:flex"
        style={{ backgroundColor: settings.primaryColor }}
      >
        <h1 className="text-3xl font-bold">{settings.systemName}</h1>
        <p className="mt-4 max-w-md text-lg text-white/90">
          Sistema administrativo para gestão de documentos e conhecimento da clínica oftalmológica.
        </p>
        <p className="mt-8 text-sm text-white/70">{settings.clinicName}</p>
      </div>
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Eye className="text-[var(--color-primary,#0d4f8b)]" size={32} />
            <div>
              <h1 className="text-xl font-bold text-slate-800">{settings.systemName}</h1>
              <p className="text-sm text-slate-500">{settings.clinicName}</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">Acesse com suas credenciais internas</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
            <Input
              label="Senha"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email.trim() || !senha}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
