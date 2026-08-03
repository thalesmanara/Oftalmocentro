import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  FilePlus2,
  RotateCcw,
  Save,
  ShieldCheck,
  Layers,
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
  createAiContextVersion,
  getAiContextDefinitions,
  getAiContextDetail,
  publishAiContextVersion,
  rollbackAiContextVersion,
  updateAiContextVersion,
  validateAiContextVersion,
  type AiContextConfiguration,
  type AiContextMode,
  type AiContextStatus,
  type AiContextVersion,
} from '@/services/aiContextService'
import { runAiTestDataset } from '@/services/aiValidationService'

type Feedback = { type: 'success' | 'error'; message: string }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusVariant(status: AiContextStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
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

function statusLabel(status: AiContextStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho'
    case 'VALIDATING':
      return 'Validando'
    case 'PUBLISHED':
      return 'Publicada'
    case 'ARCHIVED':
      return 'Arquivada'
    case 'REJECTED':
      return 'Rejeitada'
    default:
      return status
  }
}

export function AiContextPage() {
  const [versions, setVersions] = useState<AiContextVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<AiContextVersion | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [definitionId, setDefinitionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [draftMode, setDraftMode] = useState<AiContextMode>('BUDGETED')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftJson, setDraftJson] = useState('{}')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [publishReason, setPublishReason] = useState('')
  const [runningDataset, setRunningDataset] = useState(false)

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  )
  const isDraft = selectedVersion?.status === 'DRAFT'
  const cfgPreview = useMemo(() => {
    try {
      return JSON.parse(draftJson) as AiContextConfiguration
    } catch {
      return null
    }
  }, [draftJson])

  const loadDetail = useCallback(async (id?: string) => {
    setLoading(true)
    setFeedback(null)
    try {
      const defs = await getAiContextDefinitions()
      const def = defs.items?.[0]
      if (!def) {
        setVersions([])
        setActiveVersion(null)
        return
      }
      setDefinitionId(def.id)
      const detail = await getAiContextDetail({ id: id || def.id })
      setVersions(detail.versions || [])
      setActiveVersion(detail.activeVersion || null)
      const pick = detail.version?.id || detail.activeVersion?.id || detail.versions?.[0]?.id || ''
      setSelectedVersionId(pick)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao carregar contexto.') })
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
      const created = await createAiContextVersion({
        mode: 'BUDGETED',
        versionLabel: `context-budget-${Date.now().toString().slice(-4)}`,
        configuration: {
          mode: 'BUDGETED',
          modelName: 'gpt-4.1-mini',
          contextLimitTokens: 32000,
          reservedResponseTokens: 1200,
          reservedSystemTokens: 2000,
          safetyMarginTokens: 800,
          maxChunks: 12,
          maxChunksPerDocument: 4,
          minChunkScore: 0,
          enableNeighbors: false,
          enableRedundancyRemoval: true,
          redundancyThreshold: 0.92,
          enableConflictPreservation: true,
        },
      })
      setFeedback({ type: 'success', message: 'Draft criado.' })
      await loadDetail(definitionId)
      if (created.version?.id) setSelectedVersionId(created.version.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao criar draft.') })
    }
  }

  async function handleSave() {
    if (!selectedVersion || !isDraft) return
    setSaving(true)
    setFeedback(null)
    try {
      const configuration = JSON.parse(draftJson) as AiContextConfiguration
      await updateAiContextVersion({
        versionId: selectedVersion.id,
        mode: draftMode,
        versionLabel: draftLabel,
        configuration: { ...configuration, mode: draftMode },
      })
      setDirty(false)
      setFeedback({ type: 'success', message: 'Draft salvo.' })
      await loadDetail(definitionId)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao salvar.') })
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    if (!selectedVersion) return
    setValidating(true)
    setFieldErrors([])
    try {
      const configuration = JSON.parse(draftJson) as AiContextConfiguration
      const result = await validateAiContextVersion({
        versionId: selectedVersion.id,
        mode: draftMode,
        versionLabel: draftLabel,
        configuration: { ...configuration, mode: draftMode },
      })
      if (result.ok === false && result.errors?.length) {
        setFieldErrors(result.errors)
        setFeedback({ type: 'error', message: 'Validação com erros.' })
      } else {
        setFeedback({ type: 'success', message: 'Configuração válida.' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha na validação.') })
    } finally {
      setValidating(false)
    }
  }

  async function handlePublish() {
    if (!selectedVersion) return
    const reason = publishReason.trim()
    if (reason.length < 20) {
      setFeedback({
        type: 'error',
        message: 'Informe um motivo específico (≥20 caracteres) para publicar/override.',
      })
      return
    }
    if (!selectedVersion.validationRunId) {
      setFeedback({
        type: 'error',
        message: 'Publicação bloqueada: associe um validationRunId válido à versão antes de publicar.',
      })
      return
    }
    try {
      await publishAiContextVersion({
        versionId: selectedVersion.id,
        override: true,
        reason,
      })
      setPublishOpen(false)
      setFeedback({ type: 'success', message: 'Versão publicada.' })
      await loadDetail(definitionId)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao publicar.') })
    }
  }

  async function handleRollback() {
    if (!selectedVersion) return
    try {
      await rollbackAiContextVersion({
        versionId: selectedVersion.id,
        reason: 'Rollback administrativo',
      })
      setRollbackOpen(false)
      setFeedback({ type: 'success', message: 'Rollback concluído.' })
      await loadDetail(definitionId)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no rollback.') })
    }
  }

  async function handleRunDataset() {
    if (!selectedVersion) return
    setRunningDataset(true)
    try {
      await runAiTestDataset({
        groupName: 'Planilhas',
        contextConfigVersionId: selectedVersion.id,
        contextConfigOverrideAllowed: true,
      })
      setFeedback({ type: 'success', message: 'Dataset disparado com override de contexto.' })
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao executar dataset.') })
    } finally {
      setRunningDataset(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Janela de Contexto"
        description="Governança do Context Window Manager da Consulta IA"
        actions={
          <div className="flex gap-2">
            <Link
              to="/ia/retrieval"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Retrieval
            </Link>
            <Link
              to="/ia/validacao"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Validação
            </Link>
            <Button onClick={() => void handleCreate()}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Novo draft
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {activeVersion && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Layers className="h-5 w-5 text-slate-500" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Ativo: {activeVersion.versionLabel} · {activeVersion.mode}
              </div>
              <div className="text-xs text-slate-500">
                Modelo {activeVersion.modelName || activeVersion.configuration?.modelName || '—'} · limite{' '}
                {activeVersion.configuration?.contextLimitTokens ?? '—'} tokens · publicada{' '}
                {formatWhen(activeVersion.publishedAt)}
              </div>
            </div>
            <Badge variant="success">PUBLISHED</Badge>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-8 text-sm text-slate-500">Carregando…</Card>
      ) : versions.length === 0 ? (
        <EmptyState icon={Layers} title="Sem versões" description="Crie um draft para começar." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Versão</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className={`cursor-pointer border-t border-slate-100 ${
                      selectedVersionId === v.id ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                    }`}
                    onClick={() => setSelectedVersionId(v.id)}
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium">{v.versionLabel}</div>
                      <div className="text-xs text-slate-500">{v.mode}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(v.status)}>{statusLabel(v.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {selectedVersion && (
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedVersion.versionLabel}</h3>
                  <p className="text-xs text-slate-500">
                    {statusLabel(selectedVersion.status)} · {selectedVersion.mode}
                    {!isDraft && ' · somente leitura'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={!isDraft || saving || !dirty} onClick={() => void handleSave()}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                  <Button variant="secondary" disabled={validating} onClick={() => void handleValidate()}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Validar
                  </Button>
                  <Button variant="secondary" disabled={runningDataset} onClick={() => void handleRunDataset()}>
                    Dataset
                  </Button>
                  {isDraft && (
                    <Button onClick={() => setPublishOpen(true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Publicar
                    </Button>
                  )}
                  {selectedVersion.status === 'ARCHIVED' && (
                    <Button variant="secondary" onClick={() => setRollbackOpen(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>

              {cfgPreview && (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="text-xs text-slate-500">Limite</div>
                    <div className="mt-1 font-medium">{cfgPreview.contextLimitTokens ?? '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="text-xs text-slate-500">Reservas</div>
                    <div className="mt-1 font-medium">
                      resp {cfgPreview.reservedResponseTokens ?? '—'} · sys{' '}
                      {cfgPreview.reservedSystemTokens ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="text-xs text-slate-500">Chunks</div>
                    <div className="mt-1 font-medium">
                      {cfgPreview.maxChunks ?? '—'} / doc {cfgPreview.maxChunksPerDocument ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="text-xs text-slate-500">Vizinhos / redundância</div>
                    <div className="mt-1 font-medium">
                      {cfgPreview.enableNeighbors ? 'on' : 'off'} ·{' '}
                      {cfgPreview.enableRedundancyRemoval ? 'on' : 'off'}
                    </div>
                  </div>
                </div>
              )}

              {fieldErrors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {fieldErrors.map((e) => (
                    <div key={`${e.field}-${e.message}`}>
                      <strong>{e.field}</strong>: {e.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">Modo</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    disabled={!isDraft}
                    value={draftMode}
                    onChange={(e) => {
                      setDraftMode(e.target.value as AiContextMode)
                      setDirty(true)
                    }}
                  >
                    <option value="LEGACY">LEGACY</option>
                    <option value="BUDGETED">BUDGETED</option>
                    <option value="BUDGETED_WITH_NEIGHBORS">BUDGETED_WITH_NEIGHBORS</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">Rótulo</span>
                  <Input
                    disabled={!isDraft}
                    value={draftLabel}
                    onChange={(e) => {
                      setDraftLabel(e.target.value)
                      setDirty(true)
                    }}
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">configuration (JSON)</span>
                <Textarea
                  className="min-h-[280px] font-mono text-xs"
                  disabled={!isDraft}
                  value={draftJson}
                  onChange={(e) => {
                    setDraftJson(e.target.value)
                    setDirty(true)
                  }}
                />
              </label>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publicar versão de contexto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handlePublish()}>Publicar</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Produção passará a usar esta versão. Informe o motivo (obrigatório em override).
        </p>
        <Textarea
          className="mt-3"
          value={publishReason}
          onChange={(e) => setPublishReason(e.target.value)}
          placeholder="Motivo da publicação"
        />
      </Modal>

      <Modal
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        title="Rollback de contexto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRollbackOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRollback()}>Confirmar rollback</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Restaura esta versão arquivada como PUBLISHED e arquiva a atual.
        </p>
      </Modal>
    </div>
  )
}
