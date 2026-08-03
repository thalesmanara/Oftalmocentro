import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Database,
  FilePlus2,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { getErrorMessage } from '@/utils/apiError'
import {
  cleanupAiCache,
  compareAiCache,
  createAiCacheVersion,
  getAiCacheDefinitions,
  getAiCacheDetail,
  invalidateAiCache,
  publishAiCacheVersion,
  rollbackAiCacheVersion,
  updateAiCacheVersion,
  validateAiCacheVersion,
  type AiCacheConfiguration,
  type AiCacheMode,
  type AiCacheStatus,
  type AiCacheVersion,
} from '@/services/aiCacheService'
import { runAiTestDataset } from '@/services/aiValidationService'

type Feedback = { type: 'success' | 'error'; message: string }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusVariant(status: AiCacheStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'DRAFT':
      return 'warning'
    case 'VALIDATING':
      return 'info'
    case 'REJECTED':
      return 'danger'
    default:
      return 'default'
  }
}

const DEFAULT_DRAFT: AiCacheConfiguration = {
  mode: 'EXACT_ONLY',
  exactEnabled: true,
  normalizedEnabled: true,
  semanticEnabled: false,
  semanticThreshold: 0.92,
  ttlSeconds: 86400,
  maxEntries: 5000,
  maxEntriesPerScope: 500,
  cacheNegativeAnswers: false,
  cacheInsufficientContext: false,
  cacheConflictResponses: false,
  cacheSensitiveQueries: false,
  requireSameSources: true,
  requireSameDocumentVersions: true,
  requireSamePromptVersion: true,
  requireSameRetrievalVersion: true,
  requireSameContextVersion: true,
  requireSameModel: true,
  scopeMode: 'PERMISSION_SET',
  cacheSchemaVersion: 'v1',
  qdrantCollection: 'oftalmocentro_query_cache',
}

export function AiCachePage() {
  const [versions, setVersions] = useState<AiCacheVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<AiCacheVersion | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [compare, setCompare] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [draftMode, setDraftMode] = useState<AiCacheMode>('EXACT_ONLY')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftJson, setDraftJson] = useState(JSON.stringify(DEFAULT_DRAFT, null, 2))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [runningDataset, setRunningDataset] = useState(false)

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  )
  const isDraft = selectedVersion?.status === 'DRAFT'

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const defs = await getAiCacheDefinitions()
      const def = defs.items?.[0]
      setStats(def?.stats || null)
      const detail = await getAiCacheDetail({})
      setVersions((detail.versions || []) as AiCacheVersion[])
      setActiveVersion((detail.activeVersion || null) as AiCacheVersion | null)
      const pick = detail.version?.id || detail.activeVersion?.id || detail.versions?.[0]?.id || ''
      setSelectedVersionId(pick)
      try {
        const cmp = await compareAiCache()
        setCompare((cmp as Record<string, unknown>) || null)
      } catch {
        setCompare(null)
      }
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao carregar cache.') })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!selectedVersion) return
    setDraftMode(selectedVersion.mode)
    setDraftLabel(selectedVersion.versionLabel || '')
    setDraftJson(JSON.stringify(selectedVersion.configuration || {}, null, 2))
    setDirty(false)
    setFieldErrors([])
  }, [selectedVersion])

  async function handleCreate() {
    try {
      const created = await createAiCacheVersion({
        mode: 'EXACT_ONLY',
        versionLabel: `cache-exact-${Date.now().toString().slice(-6)}`,
        configuration: { ...DEFAULT_DRAFT, mode: 'EXACT_ONLY' },
        notes: 'Draft Etapa 22',
      })
      setFeedback({ type: 'success', message: 'Draft criado.' })
      await loadDetail()
      if (created.version?.id) setSelectedVersionId(created.version.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao criar draft.') })
    }
  }

  async function handleSave() {
    if (!selectedVersion || !isDraft) return
    setSaving(true)
    try {
      const configuration = JSON.parse(draftJson) as AiCacheConfiguration
      await updateAiCacheVersion({
        versionId: selectedVersion.id,
        mode: draftMode,
        versionLabel: draftLabel,
        configuration: { ...configuration, mode: draftMode },
      })
      setDirty(false)
      setFeedback({ type: 'success', message: 'Draft salvo.' })
      await loadDetail()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao salvar.') })
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    setValidating(true)
    setFieldErrors([])
    try {
      const configuration = JSON.parse(draftJson) as AiCacheConfiguration
      const res = await validateAiCacheVersion({ mode: draftMode, configuration: { ...configuration, mode: draftMode } })
      if ((res as { ok?: boolean }).ok === false || (res as { fields?: unknown }).fields) {
        setFieldErrors(((res as { fields?: Array<{ field: string; message: string }> }).fields || []) as Array<{ field: string; message: string }>)
        setFeedback({ type: 'error', message: 'Validação rejeitou a configuração.' })
      } else {
        setFeedback({ type: 'success', message: 'Configuração válida.' })
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'Falha na validação.')
      setFeedback({ type: 'error', message: msg })
    } finally {
      setValidating(false)
    }
  }

  async function handleDataset() {
    if (!selectedVersion) return
    setRunningDataset(true)
    try {
      const run = await runAiTestDataset({
        groupName: 'Planilhas',
        cacheConfigVersionId: selectedVersion.id,
      })
      setFeedback({
        type: 'success',
        message: `Dataset ${run.run?.status || 'ok'} — use o runId no publish se necessário.`,
      })
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no dataset.') })
    } finally {
      setRunningDataset(false)
    }
  }

  async function handlePublish() {
    if (!selectedVersion) return
    try {
      await publishAiCacheVersion({
        versionId: selectedVersion.id,
        override: true,
        reason: 'publicação administrativa cache',
      })
      setPublishOpen(false)
      setFeedback({ type: 'success', message: 'Versão publicada. Produção recomenda SHADOW.' })
      await loadDetail()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao publicar.') })
    }
  }

  async function handleRollback() {
    if (!activeVersion && !selectedVersion) return
    const target = versions.find((v) => v.versionLabel === 'cache-shadow-v1') || activeVersion
    if (!target) return
    try {
      await rollbackAiCacheVersion({
        targetVersionId: target.id,
        reason: 'rollback administrativo para shadow',
      })
      setRollbackOpen(false)
      setFeedback({ type: 'success', message: 'Rollback executado.' })
      await loadDetail()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no rollback.') })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cache da IA"
        description="Cache semântico em modo conservador. Produção inicia em SHADOW (não serve resposta do cache)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadDetail()}>
              Atualizar
            </Button>
            <Button onClick={() => void handleCreate()}>
              <FilePlus2 className="h-4 w-4" /> Novo draft
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Publicada</h2>
          {activeVersion ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="success">{activeVersion.mode}</Badge>
                <span className="font-medium">{activeVersion.versionLabel}</span>
              </div>
              <p className="text-xs text-slate-500">Publicada em {formatWhen(activeVersion.publishedAt)}</p>
              {activeVersion.mode === 'SHADOW' && (
                <p className="text-xs text-amber-800">
                  SHADOW: consulta e mede candidatos, mas não devolve resposta do cache.
                </p>
              )}
            </div>
          ) : (
            <EmptyState icon={Database} title="Sem versão publicada" description="Publique um draft válido." />
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>Entradas: {stats?.entryCount ?? '—'}</div>
            <div>Válidas: {stats?.validCount ?? '—'}</div>
            <div>Expiradas: {stats?.expiredCount ?? '—'}</div>
            <div>Invalidadas: {stats?.invalidatedCount ?? '—'}</div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await cleanupAiCache()
                  setFeedback({ type: 'success', message: 'Cleanup executado.' })
                  await loadDetail()
                } catch (err) {
                  setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no cleanup.') })
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Limpar expirados
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await invalidateAiCache({ all: true, reason: 'ADMIN_MANUAL' })
                  setFeedback({ type: 'success', message: 'Cache invalidado.' })
                  await loadDetail()
                } catch (err) {
                  setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao invalidar.') })
                }
              }}
            >
              Invalidar tudo
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Ver também <Link className="underline" to="/ia/validacao">Validação IA</Link> e{' '}
            <Link className="underline" to="/ia/contexto">Contexto</Link>.
          </p>
        </Card>

        <Card className="lg:col-span-2 space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Versão</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionLabel} · {v.status} · {v.mode}
                  </option>
                ))}
              </select>
            </label>
            {selectedVersion && <Badge variant={statusVariant(selectedVersion.status)}>{selectedVersion.status}</Badge>}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : !selectedVersion ? (
            <EmptyState icon={Database} title="Nenhuma versão" description="Crie um draft para começar." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Rótulo"
                  value={draftLabel}
                  disabled={!isDraft}
                  onChange={(e) => {
                    setDraftLabel(e.target.value)
                    setDirty(true)
                  }}
                />
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">Modo</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draftMode}
                    disabled={!isDraft}
                    onChange={(e) => {
                      setDraftMode(e.target.value as AiCacheMode)
                      setDirty(true)
                    }}
                  >
                    <option value="DISABLED">DISABLED</option>
                    <option value="SHADOW">SHADOW</option>
                    <option value="EXACT_ONLY">EXACT_ONLY</option>
                    <option value="NORMALIZED">NORMALIZED</option>
                    <option value="SEMANTIC">SEMANTIC</option>
                  </select>
                </label>
              </div>
              <Textarea
                label="configuration (JSON)"
                rows={16}
                value={draftJson}
                disabled={!isDraft}
                onChange={(e) => {
                  setDraftJson(e.target.value)
                  setDirty(true)
                }}
              />
              {fieldErrors.length > 0 && (
                <ul className="text-xs text-red-700">
                  {fieldErrors.map((f) => (
                    <li key={f.field}>
                      {f.field}: {f.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!isDraft || !dirty || saving} onClick={() => void handleSave()}>
                  <Save className="h-4 w-4" /> Salvar
                </Button>
                <Button variant="secondary" disabled={validating} onClick={() => void handleValidate()}>
                  <ShieldCheck className="h-4 w-4" /> Validar
                </Button>
                <Button variant="secondary" disabled={runningDataset} onClick={() => void handleDataset()}>
                  <Database className="h-4 w-4" /> Dataset
                </Button>
                <Button disabled={!isDraft} onClick={() => setPublishOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Publicar
                </Button>
                <Button variant="secondary" onClick={() => setRollbackOpen(true)}>
                  <RotateCcw className="h-4 w-4" /> Rollback → shadow
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {compare && (
        <Card className="p-4 text-xs text-slate-600">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Métricas / compare</h3>
          <pre className="overflow-auto rounded bg-slate-50 p-3">{JSON.stringify(compare, null, 2)}</pre>
        </Card>
      )}

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publicar cache">
        <p className="text-sm text-slate-600">
          Produção deve permanecer em SHADOW até evidência objetiva. Publicar EXACT_ONLY só após validação
          administrativa explícita.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPublishOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handlePublish()}>Confirmar publicação</Button>
        </div>
      </Modal>

      <Modal open={rollbackOpen} onClose={() => setRollbackOpen(false)} title="Rollback">
        <p className="text-sm text-slate-600">Restaurar cache-shadow-v1 como PUBLISHED.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRollbackOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleRollback()}>Confirmar rollback</Button>
        </div>
      </Modal>
    </div>
  )
}
