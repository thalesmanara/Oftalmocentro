import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getSystemHealth, type HealthComponent, type HealthStatus, type SystemHealth } from '@/services/healthService'
import { getErrorMessage } from '@/utils/apiError'

type UiState = 'loading' | HealthStatus | 'error'

const COMPONENT_LABELS: Record<string, string> = {
  n8n: 'n8n',
  database: 'PostgreSQL',
  storage: 'Armazenamento',
  tika: 'Apache Tika',
  configuration: 'Configuração',
  sessions: 'Sessões',
  audit: 'Auditoria',
  documents: 'Documentos',
  backup: 'Backup',
  aiEval: 'Validação IA',
  aiPrompts: 'Prompts da IA',
  embeddings: 'Embeddings',
  qdrant: 'Qdrant',
}

function statusLabel(status: UiState): string {
  switch (status) {
    case 'ok':
      return 'Operacional'
    case 'degraded':
      return 'Degradado'
    case 'down':
      return 'Indisponível'
    case 'loading':
      return 'Verificando…'
    default:
      return 'Erro na verificação'
  }
}

function statusTone(status: UiState): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'degraded':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'down':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'loading':
      return 'bg-slate-50 text-slate-600 border-slate-200'
    default:
      return 'bg-red-50 text-red-800 border-red-200'
  }
}

function formatCheckedAt(value?: string): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function componentDetails(key: string, component: HealthComponent): string {
  const parts: string[] = []
  if (typeof component.durationMs === 'number') {
    parts.push(`${component.durationMs} ms`)
  }
  if (key === 'storage' && typeof component.storageAvailable === 'boolean') {
    parts.push(component.storageAvailable ? 'disponível' : 'indisponível')
  }
  if (key === 'sessions' && typeof component.activeCount === 'number') {
    parts.push(`${component.activeCount} ativas`)
  }
  if (key === 'configuration' && component.openai) {
    parts.push(`OpenAI: ${component.openai}`)
  }
  if (key === 'documents') {
    if (typeof component.total === 'number') parts.push(`${component.total} total`)
    if (typeof component.processing === 'number') parts.push(`${component.processing} processando`)
    if (typeof component.errors === 'number') parts.push(`${component.errors} erro`)
    if (typeof component.missingFiles === 'number') parts.push(`${component.missingFiles} sem arquivo`)
  }
  if (key === 'backup') {
    if (component.lastBackupType) parts.push(component.lastBackupType)
    if (component.lastBackupStatus) parts.push(component.lastBackupStatus)
    if (typeof component.ageHours === 'number') parts.push(`${component.ageHours}h`)
  }
  if (key === 'aiEval') {
    if (typeof component.lastScore === 'number') parts.push(`score ${component.lastScore}`)
    if (typeof component.casesCount === 'number') parts.push(`${component.casesCount} casos`)
    if (typeof component.avgDurationMs === 'number') parts.push(`${component.avgDurationMs} ms`)
    if (component.lastRunAt) parts.push(formatCheckedAt(component.lastRunAt))
  }
  if (key === 'aiPrompts') {
    // Nunca exibir o conteúdo do prompt aqui — apenas metadados de versão.
    if (component.activeVersion) parts.push(`versão ativa ${component.activeVersion}`)
    if (component.model) parts.push(component.model)
    if (typeof component.draftsCount === 'number') parts.push(`${component.draftsCount} rascunho(s)`)
  }
  if (key === 'embeddings') {
    // Nunca exibir vetores aqui — apenas contagens e metadados.
    if (component.model) parts.push(component.model)
    if (typeof component.pending === 'number') parts.push(`${component.pending} pendentes`)
    if (typeof component.total === 'number') parts.push(`${component.total} válidos`)
    if (typeof component.failures === 'number') parts.push(`${component.failures} falhas`)
    if (typeof component.queue === 'number') parts.push(`fila ${component.queue}`)
    if (typeof component.avgDurationMs === 'number') parts.push(`${component.avgDurationMs} ms`)
    if (component.lastRunAt) parts.push(formatCheckedAt(component.lastRunAt))
  }
  if (key === 'qdrant') {
    if (typeof component.online === 'boolean') {
      parts.push(component.online ? 'online' : 'offline')
    }
    if (component.collection) parts.push(component.collection)
    if (typeof component.total === 'number') parts.push(`${component.total} pontos`)
    if (typeof component.pending === 'number') parts.push(`${component.pending} pendentes`)
    if (typeof component.failures === 'number') parts.push(`${component.failures} falhas`)
    if (typeof component.avgDurationMs === 'number') parts.push(`${component.avgDurationMs} ms`)
    if (component.lastRunAt) parts.push(formatCheckedAt(component.lastRunAt))
  }
  return parts.join(' · ')
}

export function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [uiState, setUiState] = useState<UiState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const runCheck = useCallback(async () => {
    setChecking(true)
    setErrorMessage(null)
    if (!health) setUiState('loading')
    try {
      const result = await getSystemHealth()
      setHealth(result)
      setUiState(result.status)
    } catch (err) {
      setUiState('error')
      setErrorMessage(getErrorMessage(err, 'Não foi possível verificar a saúde do sistema.'))
    } finally {
      setChecking(false)
    }
  }, [health])

  useEffect(() => {
    void runCheck()
    // Apenas na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const components = health?.components ?? {}

  return (
    <Card
      title="Diagnóstico operacional"
      subtitle="Verificação sob demanda dos componentes essenciais do sistema"
      className="mt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-lg border px-3 py-1 text-sm font-medium ${statusTone(uiState)}`}
          >
            Status geral: {statusLabel(uiState)}
          </span>
          <p className="mt-2 text-sm text-slate-500">
            Última verificação: {formatCheckedAt(health?.checkedAt)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void runCheck()} disabled={checking}>
          {checking ? 'Verificando…' : 'Verificar novamente'}
        </Button>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </p>
      )}

      {uiState === 'loading' && !health ? (
        <p className="mt-4 text-sm text-slate-500">Carregando diagnóstico…</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {Object.entries(COMPONENT_LABELS).map(([key, label]) => {
            const component = components[key as keyof typeof components]
            if (!component) {
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="text-slate-400">—</span>
                </li>
              )
            }
            const status = (component.status === 'unknown' ? 'degraded' : component.status) as HealthStatus
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-700">{label}</p>
                  <p className="text-slate-500">{componentDetails(key, component) || '—'}</p>
                </div>
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusTone(status)}`}>
                  {statusLabel(status)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
