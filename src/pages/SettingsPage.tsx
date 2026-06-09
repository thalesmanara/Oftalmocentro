import { useEffect, useState } from 'react'
import { logAction } from '@/services/auditService'
import type { SystemSettings } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function SettingsPage() {
  const { user } = useAuth()
  const { settings, loading, updateSettings } = useSettings()
  const [form, setForm] = useState<SystemSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) {
      setForm(settings)
    }
  }, [settings, loading])

  const handleSave = async () => {
    if (!form || !user) return
    setSaving(true)
    try {
      await updateSettings(form)
      logAction(user.name, 'Alteração de configurações', 'Sistema', 'Configurações do sistema atualizadas')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return <p className="text-slate-500">Carregando...</p>

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Personalização visual e identidade do sistema"
      />
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
            {saved && <span className="text-sm text-emerald-600">Configurações salvas!</span>}
          </div>
        </div>
      </Card>
    </div>
  )
}
