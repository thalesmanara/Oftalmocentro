import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  ShieldCheck,
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
  createAiRetrievalVersion,
  getAiRetrievalDefinitions,
  getAiRetrievalDetail,
  publishAiRetrievalVersion,
  rollbackAiRetrievalVersion,
  updateAiRetrievalVersion,
  validateAiRetrievalVersion,
  type AiRetrievalConfiguration,
  type AiRetrievalDefinition,
  type AiRetrievalMode,
  type AiRetrievalStatus,
  type AiRetrievalVersion,
} from '@/services/aiRetrievalService'
import { runAiTestDataset } from '@/services/aiValidationService'

type Feedback = { type: 'success' | 'error'; message: string }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusVariant(status: AiRetrievalStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
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

function statusLabel(status: AiRetrievalStatus): string {
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

function modeLabel(mode?: string | null): string {
  switch (mode) {
    case 'TEXT_ONLY':
      return 'Somente texto'
    case 'VECTOR_ONLY':
      return 'Somente vetorial'
    case 'HYBRID':
      return 'Híbrido'
    case 'HYBRID_RERANK':
      return 'Híbrido + re-ranking'
    default:
      return mode || '—'
  }
}

export function AiRetrievalPage() {
  const [definitions, setDefinitions] = useState<AiRetrievalDefinition[]>([])
  const [definitionsLoading, setDefinitionsLoading] = useState(true)
  const [definitionsError, setDefinitionsError] = useState<string | null>(null)
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null)

  const [versions, setVersions] = useState<AiRetrievalVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<AiRetrievalVersion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<AiRetrievalVersion | null>(null)

  const [draftMode, setDraftMode] = useState<AiRetrievalMode>('HYBRID_RERANK')
  const [draftJson, setDraftJson] = useState('')
  const [dirty, setDirty] = useState(false)

  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [runningDataset, setRunningDataset] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [validationResult, setValidationResult] = useState<{ errors: string[]; warnings: string[] } | null>(
    null
  )

  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false)
  const [rollbackReason, setRollbackReason] = useState('')

  const loadDefinitions = useCallback(async () => {
    setDefinitionsLoading(true)
    setDefinitionsError(null)
    try {
      const result = await getAiRetrievalDefinitions()
      setDefinitions(result.items)
      setSelectedDefinitionId((prev) => prev ?? result.items[0]?.id ?? null)
    } catch (err) {
      setDefinitions([])
      setDefinitionsError(getErrorMessage(err, 'Erro ao carregar configurações de retrieval.'))
    } finally {
      setDefinitionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDefinitions()
  }, [loadDefinitions])

  const loadDefinitionDetail = useCallback(async (definitionId: string, preferVersionId?: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await getAiRetrievalDetail({ id: definitionId })
      setVersions(detail.versions)
      setActiveVersion(detail.activeVersion ?? null)
      const nextVersionId =
        preferVersionId ?? detail.activeVersion?.id ?? detail.versions[0]?.id ?? null
      setSelectedVersionId(nextVersionId)
    } catch (err) {
      setVersions([])
      setActiveVersion(null)
      setSelectedVersionId(null)
      setDetailError(getErrorMessage(err, 'Erro ao carregar versões de retrieval.'))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDefinitionId) void loadDefinitionDetail(selectedDefinitionId)
  }, [selectedDefinitionId, loadDefinitionDetail])

  const loadVersionDetail = useCallback(async (versionId: string) => {
    setFeedback(null)
    setValidationResult(null)
    try {
      const detail = await getAiRetrievalDetail({ versionId })
      const version = detail.version ?? detail.versions.find((v) => v.id === versionId) ?? null
      setSelectedVersion(version)
      setDraftMode((version?.mode as AiRetrievalMode) || 'HYBRID')
      setDraftJson(JSON.stringify(version?.configuration ?? {}, null, 2))
      setDirty(false)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao carregar a versão.') })
    }
  }, [])

  useEffect(() => {
    if (selectedVersionId) void loadVersionDetail(selectedVersionId)
  }, [selectedVersionId, loadVersionDetail])

  const selectedDef = useMemo(
    () => definitions.find((d) => d.id === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId]
  )

  const isDraft = selectedVersion?.status === 'DRAFT'

  async function handleCreateDraft() {
    setCreating(true)
    setFeedback(null)
    try {
      const base = activeVersion?.configuration ?? selectedVersion?.configuration ?? {}
      const created = await createAiRetrievalVersion({
        mode: 'HYBRID_RERANK',
        configuration: { ...base, mode: 'HYBRID_RERANK' },
        changeSummary: 'Novo rascunho a partir da configuração ativa',
      })
      setFeedback({ type: 'success', message: 'Rascunho criado.' })
      if (selectedDefinitionId) await loadDefinitionDetail(selectedDefinitionId, created.version?.id)
      await loadDefinitions()
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao criar rascunho.') })
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!selectedVersion || !isDraft) return
    setSaving(true)
    setFeedback(null)
    try {
      let configuration: AiRetrievalConfiguration
      try {
        configuration = JSON.parse(draftJson) as AiRetrievalConfiguration
      } catch {
        setFeedback({ type: 'error', message: 'JSON de configuração inválido.' })
        setSaving(false)
        return
      }
      await updateAiRetrievalVersion({
        versionId: selectedVersion.id,
        mode: draftMode,
        configuration: { ...configuration, mode: draftMode },
      })
      setFeedback({ type: 'success', message: 'Rascunho salvo.' })
      setDirty(false)
      if (selectedDefinitionId) await loadDefinitionDetail(selectedDefinitionId, selectedVersion.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao salvar rascunho.') })
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    setValidating(true)
    setFeedback(null)
    try {
      let configuration: AiRetrievalConfiguration = {}
      try {
        configuration = JSON.parse(draftJson) as AiRetrievalConfiguration
      } catch {
        setValidationResult({ errors: ['JSON inválido'], warnings: [] })
        setValidating(false)
        return
      }
      const result = await validateAiRetrievalVersion({
        versionId: selectedVersion?.id,
        mode: draftMode,
        configuration,
      })
      setValidationResult({ errors: result.errors || [], warnings: result.warnings || [] })
      setFeedback({
        type: result.ok ? 'success' : 'error',
        message: result.ok ? 'Validação concluída sem erros.' : 'Validação encontrou problemas.',
      })
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha na validação.') })
    } finally {
      setValidating(false)
    }
  }

  async function handleRunDataset() {
    setRunningDataset(true)
    setFeedback(null)
    try {
      await runAiTestDataset({ groupName: 'Planilhas', includeMissingDocs: false })
      setFeedback({
        type: 'success',
        message: 'Dataset executado. Compare o resultado em Validação IA (modo publicado permanece HYBRID até publicação explícita).',
      })
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao executar dataset.') })
    } finally {
      setRunningDataset(false)
    }
  }

  async function handlePublish() {
    if (!selectedVersion) return
    setPublishing(true)
    setFeedback(null)
    try {
      await publishAiRetrievalVersion({ versionId: selectedVersion.id })
      setPublishModalOpen(false)
      setFeedback({ type: 'success', message: 'Configuração publicada. Produção agora usa esta versão.' })
      await loadDefinitions()
      if (selectedDefinitionId) await loadDefinitionDetail(selectedDefinitionId, selectedVersion.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao publicar.') })
    } finally {
      setPublishing(false)
    }
  }

  async function handleRollback() {
    if (!selectedVersion || !rollbackReason.trim()) return
    setRollingBack(true)
    setFeedback(null)
    try {
      await rollbackAiRetrievalVersion({
        targetVersionId: selectedVersion.id,
        reason: rollbackReason.trim(),
      })
      setRollbackModalOpen(false)
      setRollbackReason('')
      setFeedback({ type: 'success', message: 'Rollback aplicado.' })
      await loadDefinitions()
      if (selectedDefinitionId) await loadDefinitionDetail(selectedDefinitionId, selectedVersion.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha no rollback.') })
    } finally {
      setRollingBack(false)
    }
  }

  const cfgPreview = useMemo(() => {
    try {
      return JSON.parse(draftJson) as AiRetrievalConfiguration
    } catch {
      return null
    }
  }, [draftJson])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retrieval / Re-ranking"
        description="Configuração versionada da recuperação híbrida e do re-ranking determinístico da Consulta IA."
        actions={
          <Link
            to="/ia/validacao"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Validação IA
          </Link>
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

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Definições</h2>
          {definitionsLoading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : definitionsError ? (
            <p className="text-sm text-red-700">{definitionsError}</p>
          ) : definitions.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="Nenhuma configuração"
              description="Execute a migration da Etapa 20."
            />
          ) : (
            <ul className="space-y-2">
              {definitions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDefinitionId(d.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedDefinitionId === d.id
                        ? 'border-[var(--color-primary,#0d4f8b)] bg-slate-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium text-slate-900">{d.code}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {modeLabel(d.activeMode || d.publishedVersion?.mode)} ·{' '}
                      {d.activeVersionLabel || d.publishedVersion?.versionLabel || '—'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {selectedDef?.code || 'Configuração'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Modo ativo: <strong>{modeLabel(selectedDef?.activeMode)}</strong> · Versão:{' '}
                  <strong>{selectedDef?.activeVersionLabel || '—'}</strong>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Produção só muda após publicação administrativa auditada. O rascunho HYBRID_RERANK não
                  altera a Consulta IA automaticamente.
                </p>
              </div>
              <Button onClick={() => void handleCreateDraft()} disabled={creating}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {creating ? 'Criando…' : 'Novo rascunho'}
              </Button>
            </div>
          </Card>

          {detailLoading ? (
            <Card className="p-6 text-sm text-slate-500">Carregando versões…</Card>
          ) : detailError ? (
            <Card className="p-6 text-sm text-red-700">{detailError}</Card>
          ) : (
            <>
              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                  Versões
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Versão</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Modo</th>
                        <th className="px-4 py-2">Limites</th>
                        <th className="px-4 py-2">Publicada</th>
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
                          <td className="px-4 py-3">
                            <div className="font-medium">{v.versionLabel}</div>
                            <div className="text-xs text-slate-500">#{v.versionNumber}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(v.status)}>{statusLabel(v.status)}</Badge>
                          </td>
                          <td className="px-4 py-3">{modeLabel(v.mode)}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            cand {v.configuration?.candidateLimit ?? '—'} / final{' '}
                            {v.configuration?.finalLimit ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs">{formatWhen(v.publishedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {selectedVersion && (
                <Card className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedVersion.versionLabel}</h3>
                      <p className="text-xs text-slate-500">
                        {statusLabel(selectedVersion.status)} · {modeLabel(selectedVersion.mode)}
                        {!isDraft && ' · somente leitura'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" disabled={!isDraft || saving} onClick={() => void handleSave()}>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Salvando…' : 'Salvar'}
                      </Button>
                      <Button variant="secondary" disabled={validating} onClick={() => void handleValidate()}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {validating ? 'Validando…' : 'Validar'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={runningDataset}
                        onClick={() => void handleRunDataset()}
                      >
                        {runningDataset ? 'Executando…' : 'Dataset (grupo Planilhas)'}
                      </Button>
                      {isDraft && (
                        <Button onClick={() => setPublishModalOpen(true)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Publicar
                        </Button>
                      )}
                      {selectedVersion.status === 'ARCHIVED' && (
                        <Button variant="secondary" onClick={() => setRollbackModalOpen(true)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>

                  {cfgPreview && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="text-xs text-slate-500">Pesos</div>
                        <div className="mt-1 font-medium">
                          sem {cfgPreview.weights?.semantic ?? '—'} · lex{' '}
                          {cfgPreview.weights?.lexical ?? '—'} · prior{' '}
                          {cfgPreview.weights?.hybridPrior ?? '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="text-xs text-slate-500">Candidatos / final</div>
                        <div className="mt-1 font-medium">
                          {cfgPreview.candidateLimit ?? '—'} → {cfgPreview.finalLimit ?? '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="text-xs text-slate-500">Máx. chunks/doc</div>
                        <div className="mt-1 font-medium">
                          {cfgPreview.maxChunksPerDocument ?? '—'}
                        </div>
                      </div>
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
                          setDraftMode(e.target.value as AiRetrievalMode)
                          setDirty(true)
                        }}
                      >
                        <option value="TEXT_ONLY">TEXT_ONLY</option>
                        <option value="VECTOR_ONLY">VECTOR_ONLY</option>
                        <option value="HYBRID">HYBRID</option>
                        <option value="HYBRID_RERANK">HYBRID_RERANK</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600">Label</span>
                      <Input value={selectedVersion.versionLabel} disabled readOnly />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">
                      Configuração JSON {dirty ? '(alterada)' : ''}
                    </span>
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

                  {validationResult && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      {validationResult.errors.length === 0 && validationResult.warnings.length === 0 ? (
                        <p className="text-emerald-700">Sem erros ou avisos.</p>
                      ) : (
                        <>
                          {validationResult.errors.map((e, i) => (
                            <p key={`e-${i}`} className="flex gap-2 text-red-700">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}
                            </p>
                          ))}
                          {validationResult.warnings.map((w, i) => (
                            <p key={`w-${i}`} className="text-amber-800">
                              {w}
                            </p>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publicar configuração de retrieval"
      >
        <p className="text-sm text-slate-600">
          Isso altera o modo ativo da Consulta IA. Só publique após comparar HYBRID × HYBRID_RERANK no
          dataset e confirmar ausência de regressão.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPublishModalOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={publishing} onClick={() => void handlePublish()}>
            {publishing ? 'Publicando…' : 'Confirmar publicação'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        title="Rollback de retrieval"
      >
        <p className="mb-3 text-sm text-slate-600">Informe o motivo do rollback (obrigatório).</p>
        <Textarea
          value={rollbackReason}
          onChange={(e) => setRollbackReason(e.target.value)}
          className="min-h-[100px]"
          placeholder="Motivo auditável…"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRollbackModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={rollingBack || !rollbackReason.trim()}
            onClick={() => void handleRollback()}
          >
            {rollingBack ? 'Aplicando…' : 'Confirmar rollback'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
