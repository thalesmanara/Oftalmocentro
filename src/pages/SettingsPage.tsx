import { useEffect, useState } from 'react'
import type { SystemSettings } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { canAccessTechnicalAdministration } from '@/utils/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { TechnicalAreaBanner } from '@/components/ui/TechnicalAreaBanner'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SystemHealthPanel } from '@/components/settings/SystemHealthPanel'
import { BackupPanel } from '@/components/settings/BackupPanel'
import { getErrorMessage } from '@/utils/apiError'

type Feedback = { type: 'success' | 'error'; message: string }

export function SettingsPage() {
  const { user } = useAuth()
  const showHealthPanel = user?.isTechnicalAdmin === true
  const showBackupPanel = canAccessTechnicalAdministration(user)
  const { settings, settingsSource, loading, loadError, updateSettings, refreshSettings } =
    useSettings()
  const [form, setForm] = useState<SystemSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    if (!loading) {
      setForm(settings)
    }
  }, [settings, loading])

  const handleSave = async () => {
    if (!form || !user) return

    setSaving(true)
    setFeedback(null)
    try {
      await updateSettings(form)
      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso.' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao salvar configurações.') })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return <p className="text-slate-500">Carregando...</p>

  return (
    <div>
      {(showHealthPanel || showBackupPanel) && <TechnicalAreaBanner />}
      <PageHeader
        title="Configurações"
        description="Personalização visual e identidade do sistema"
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Não foi possível carregar as configurações da API. Exibindo valores padrão visuais
            {settingsSource === 'default' ? '' : ' (última configuração conhecida)'}.
          </p>
          <p className="mt-1 text-amber-800">{loadError}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void refreshSettings()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {feedback && (
        <p
          className={`mb-4 text-sm ${
            feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Card>
        <div className="max-w-lg space-y-4">
          <Input
            label="Nome do sistema"
            value={form.systemName}
            onChange={(e) => setForm({ ...form, systemName: e.target.value })}
          />
          <Input
            label="Nome da clínica"
            value={form.clinicName}
            onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
          />
          <Input
            label="URL do logo"
            value={form.logoUrl ?? ''}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value || null })}
            placeholder="https://..."
          />
          {form.logoUrl && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Prévia do logo</p>
              <img
                src={form.logoUrl}
                alt={form.systemName}
                className="mx-auto h-12 max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Cor principal</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Cor secundária</label>
              <input
                type="color"
                value={form.secondaryColor ?? '#0f172a'}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Card>

      {showHealthPanel && <SystemHealthPanel />}
      {showBackupPanel && <BackupPanel />}
    </div>
  )
}
