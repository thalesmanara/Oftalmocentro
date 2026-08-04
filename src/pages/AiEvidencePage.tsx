import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus2, RotateCcw, Save, ShieldCheck, Fingerprint } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TechnicalAreaBanner } from '@/components/ui/TechnicalAreaBanner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { getErrorMessage } from '@/utils/apiError'
import {
  compareAiEvidence,
  createAiEvidenceVersion,
  getAiEvidenceDefinitions,
  getAiEvidenceDetail,
  publishAiEvidenceVersion,
  rollbackAiEvidenceVersion,
  updateAiEvidenceVersion,
  validateAiEvidenceVersion,
  type AiEvidenceConfiguration,
  type AiEvidenceMode,
  type AiEvidenceStatus,
  type AiEvidenceVersion,
} from '@/services/aiEvidenceService'
import { runAiTestDataset } from '@/services/aiValidationService'

type Feedback = { type: 'success' | 'error'; message: string }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusVariant(status: AiEvidenceStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
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

const DEFAULT_DRAFT: AiEvidenceConfiguration = {
  mode: 'STRUCTURED_STRICT',
  enableEvidenceScore: true,
  enableClassification: true,
  enableConflictConsolidation: true,
  enableRedundancyDetection: true,
  enableRichSources: true,
  passthroughToCwm: true,
  minEvidenceScore: 40,
  redundancyThreshold: 0.9,
  dropBelowMinScore: true,
  notes: 'Draft Evidence Layer',
}

export function AiEvidencePage() {
  const [versions, setVersions] = useState<AiEvidenceVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<AiEvidenceVersion | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [compare, setCompare] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [draftMode, setDraftMode] = useState<AiEvidenceMode>('STRUCTURED_STRICT')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftJson, setDraftJson] = useState(JSON.stringify(DEFAULT_DRAFT, null, 2))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [runningDataset, setRunningDataset] = useState(false)
  const [activeMode, setActiveMode] = useState('STRUCTURED')
  const [activeLabel, setActiveLabel] = useState('evidence-v1')

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  )
  const isDraft = selectedVersion?.status === 'DRAFT'

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const defs = await getAiEvidenceDefinitions()
      const def = defs.items?.[0]
      setActiveMode(String(def?.activeMode || 'STRUCTURED'))
      setActiveLabel(String(def?.activeVersionLabel || 'evidence-v1'))
      const detail = await getAiEvidenceDetail({})
      setVersions((detail.versions || []) as AiEvidenceVersion[])
      setActiveVersion((detail.activeVersion || null) as AiEvidenceVersion | null)
      const pick = detail.version?.id || detail.activeVersion?.id || detail.versions?.[0]?.id || ''
      setSelectedVersionId(pick)
      try {
        setCompare((await compareAiEvidence()) as Record<string, unknown>)
      } catch {
        setCompare(null)
      }
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao carregar evidências.') })
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
      const created = await createAiEvidenceVersion({
        mode: 'STRUCTURED_STRICT',
        versionLabel: `evidence-draft-${Date.now().toString().slice(-6)}`,
        configuration: { ...DEFAULT_DRAFT, mode: 'STRUCTURED_STRICT' },
        notes: 'Draft Etapa 23',
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
      const configuration = JSON.parse(draftJson) as AiEvidenceConfiguration
      await updateAiEvidenceVersion({
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
      const configuration = JSON.parse(draftJson) as AiEvidenceConfiguration
      const res = await validateAiEvidenceVersion({
        mode: draftMode,
        configuration: { ...configuration, mode: draftMode },
      })
      if (res.ok === false) {
        setFieldErrors(res.errors || [])
        setFeedback({ type: 'error', message: 'Validação rejeitou a configuração.' })
      } else {
        setFeedback({ type: 'success', message: 'Configuração válida.' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha na validação.') })
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
        evidenceConfigVersionId: selectedVersion.id,
      })
      setFeedback({
        type: 'success',
        message: `Dataset ${run.run?.status || 'ok'} — métricas de evidência no laboratório.`,
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
      await publishAiEvidenceVersion({ versionId: selectedVersion.id, reason: 'publicação administrativa evidence' })
      setPublishOpen(false)
      setFeedback({ type: 'success', message: 'Versão publicada.' })
      await loadDetail()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao publicar.') })
    }
  }

  async function handleRollback() {
    const target = versions.find((v) => v.versionLabel === 'evidence-v1') || activeVersion
    if (!target) return
    try {
      await rollbackAiEvidenceVersion({ targetVersionId: target.id, reason: 'rollback para evidence-v1' })
      setRollbackOpen(false)
      setFeedback({ type: 'success', message: 'Rollback executado.' })
      await loadDetail()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no rollback.') })
    }
  }

  return (
    <div className="space-y-6">
      <TechnicalAreaBanner />
      <PageHeader
        title="Evidências da IA"
        description="Camada estruturada entre Retrieval e Janela de Contexto. Produção: evidence-v1."
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
        <Card className="space-y-3 p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-800">Publicada</h2>
          {activeVersion ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="success">{activeVersion.mode}</Badge>
                <span className="font-medium">{activeVersion.versionLabel}</span>
              </div>
              <p className="text-xs text-slate-500">Secrets: {activeMode} / {activeLabel}</p>
              <p className="text-xs text-slate-500">Publicada em {formatWhen(activeVersion.publishedAt)}</p>
            </div>
          ) : (
            <EmptyState icon={Fingerprint} title="Sem versão publicada" description="Publique um draft válido." />
          )}
          <div className="text-xs text-slate-600 space-y-1">
            <div>Evidence Score: calculado por consulta (0–100)</div>
            <div>Conflitos / redundância: consolidação determinística</div>
            <div>Fontes: enriquecidas sem paths/hashes/vetores</div>
          </div>
          <p className="text-xs text-slate-500">
            Ver <Link className="underline" to="/ia/validacao">Validação</Link>,{' '}
            <Link className="underline" to="/ia/retrieval">Retrieval</Link> e{' '}
            <Link className="underline" to="/ia/contexto">Contexto</Link>.
          </p>
          {compare && (
            <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
              {JSON.stringify(compare, null, 2)}
            </pre>
          )}
        </Card>

        <Card className="space-y-4 p-4 lg:col-span-2">
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
            {selectedVersion && (
              <Badge variant={statusVariant(selectedVersion.status)}>{selectedVersion.status}</Badge>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : !selectedVersion ? (
            <EmptyState icon={Fingerprint} title="Nenhuma versão" description="Crie um draft." />
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
                      setDraftMode(e.target.value as AiEvidenceMode)
                      setDirty(true)
                    }}
                  >
                    <option value="DISABLED">DISABLED</option>
                    <option value="PASSTHROUGH">PASSTHROUGH</option>
                    <option value="STRUCTURED">STRUCTURED</option>
                    <option value="STRUCTURED_STRICT">STRUCTURED_STRICT</option>
                  </select>
                </label>
              </div>
              <Textarea
                label="Configuration (JSON)"
                className="min-h-[220px] font-mono text-xs"
                value={draftJson}
                disabled={!isDraft}
                onChange={(e) => {
                  setDraftJson(e.target.value)
                  setDirty(true)
                }}
              />
              {!!fieldErrors.length && (
                <ul className="text-xs text-red-700 list-disc pl-4">
                  {fieldErrors.map((e) => (
                    <li key={e.field}>
                      {e.field}: {e.message}
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
                  Dataset
                </Button>
                <Button disabled={!isDraft} onClick={() => setPublishOpen(true)}>
                  Publicar
                </Button>
                <Button variant="secondary" onClick={() => setRollbackOpen(true)}>
                  <RotateCcw className="h-4 w-4" /> Rollback
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publicar evidência">
        <p className="text-sm text-slate-600">Publica o draft selecionado e arquiva a versão publicada anterior.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPublishOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handlePublish()}>Confirmar</Button>
        </div>
      </Modal>
      <Modal open={rollbackOpen} onClose={() => setRollbackOpen(false)} title="Rollback evidência">
        <p className="text-sm text-slate-600">Restaura evidence-v1 (ou a ativa) como publicada.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRollbackOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleRollback()}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  )
}
