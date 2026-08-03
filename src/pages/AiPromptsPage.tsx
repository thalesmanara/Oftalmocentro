import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  GitCompareArrows,
  RotateCcw,
  Rss,
  Save,
  ScrollText,
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
  compareAiPromptVersions,
  createAiPromptVersion,
  getAiPromptDefinitions,
  getAiPromptDetail,
  publishAiPromptVersion,
  rollbackAiPromptVersion,
  updateAiPromptVersion,
  validateAiPromptVersion,
  type AiPromptCompareResult,
  type AiPromptDefinition,
  type AiPromptStatus,
  type AiPromptVersion,
} from '@/services/aiPromptsService'
import { runAiTestDataset } from '@/services/aiValidationService'

type Feedback = { type: 'success' | 'error'; message: string }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function shortHash(hash?: string | null): string {
  if (!hash) return '—'
  return hash.length > 10 ? `${hash.slice(0, 10)}…` : hash
}

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function statusVariant(status: AiPromptStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'DRAFT':
      return 'warning'
    case 'VALIDATING':
      return 'info'
    case 'REJECTED':
      return 'danger'
    case 'ARCHIVED':
    default:
      return 'default'
  }
}

function statusLabel(status: AiPromptStatus): string {
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

export function AiPromptsPage() {
  const [definitions, setDefinitions] = useState<AiPromptDefinition[]>([])
  const [definitionsLoading, setDefinitionsLoading] = useState(true)
  const [definitionsError, setDefinitionsError] = useState<string | null>(null)
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null)

  const [versions, setVersions] = useState<AiPromptVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<AiPromptVersion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<AiPromptVersion | null>(null)
  const [versionLoading, setVersionLoading] = useState(false)

  const [draftContent, setDraftContent] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [draftTemperature, setDraftTemperature] = useState('')
  const [draftMaxTokens, setDraftMaxTokens] = useState('')
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
  const [forceOverride, setForceOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const [rollbackModalOpen, setRollbackModalOpen] = useState(false)
  const [rollbackReason, setRollbackReason] = useState('')

  const [compareOpen, setCompareOpen] = useState(false)
  const [compareAId, setCompareAId] = useState('')
  const [compareBId, setCompareBId] = useState('')
  const [compareResult, setCompareResult] = useState<AiPromptCompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const loadDefinitions = useCallback(async () => {
    setDefinitionsLoading(true)
    setDefinitionsError(null)
    try {
      const result = await getAiPromptDefinitions()
      setDefinitions(result.items)
      setSelectedDefinitionId((prev) => prev ?? result.items[0]?.id ?? null)
    } catch (err) {
      setDefinitions([])
      setDefinitionsError(getErrorMessage(err, 'Erro ao carregar prompts cadastrados.'))
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
      const detail = await getAiPromptDetail({ id: definitionId })
      setVersions(detail.versions)
      setActiveVersion(detail.activeVersion ?? null)
      const nextVersionId =
        preferVersionId ?? detail.activeVersion?.id ?? detail.versions[0]?.id ?? null
      setSelectedVersionId(nextVersionId)
    } catch (err) {
      setVersions([])
      setActiveVersion(null)
      setSelectedVersionId(null)
      setDetailError(getErrorMessage(err, 'Erro ao carregar versões do prompt.'))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDefinitionId) void loadDefinitionDetail(selectedDefinitionId)
  }, [selectedDefinitionId, loadDefinitionDetail])

  const loadVersionDetail = useCallback(async (versionId: string) => {
    setVersionLoading(true)
    setFeedback(null)
    setValidationResult(null)
    try {
      const detail = await getAiPromptDetail({ versionId })
      const version = detail.version ?? null
      setSelectedVersion(version)
      setDraftContent(version?.content ?? '')
      setDraftModel(version?.modelName ?? '')
      setDraftTemperature(version?.temperature != null ? String(version.temperature) : '')
      setDraftMaxTokens(version?.maxTokens != null ? String(version.maxTokens) : '')
      setDirty(false)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao carregar a versão selecionada.') })
    } finally {
      setVersionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedVersionId) void loadVersionDetail(selectedVersionId)
    else setSelectedVersion(null)
  }, [selectedVersionId, loadVersionDetail])

  const selectedDefinition = useMemo(
    () => definitions.find((d) => d.id === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId]
  )

  const isDraft = selectedVersion?.status === 'DRAFT'
  const isArchived = selectedVersion?.status === 'ARCHIVED'

  const refreshAfterMutation = async (versionId?: string) => {
    if (selectedDefinitionId) await loadDefinitionDetail(selectedDefinitionId, versionId)
  }

  const handleCreateVersion = async () => {
    if (!selectedDefinitionId) return
    const base = activeVersion ?? selectedVersion
    if (!base) {
      setFeedback({ type: 'error', message: 'Nenhuma versão base disponível para clonar.' })
      return
    }
    setCreating(true)
    setFeedback(null)
    try {
      const result = await createAiPromptVersion({
        promptDefinitionId: selectedDefinitionId,
        basedOnVersionId: base.id,
        content: base.content,
        modelName: base.modelName,
        temperature: base.temperature ?? undefined,
        maxTokens: base.maxTokens ?? undefined,
        topP: base.topP ?? undefined,
        parameters: base.parameters,
        changeSummary: `Nova versão a partir de v${base.versionNumber}.`,
      })
      setFeedback({ type: 'success', message: `Nova versão v${result.version.versionNumber} criada como rascunho.` })
      await refreshAfterMutation(result.version.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao criar nova versão.') })
    } finally {
      setCreating(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedVersion) return
    setSaving(true)
    setFeedback(null)
    try {
      await updateAiPromptVersion({
        versionId: selectedVersion.id,
        content: draftContent,
        modelName: draftModel.trim() === '' ? undefined : draftModel,
        temperature: toOptionalNumber(draftTemperature),
        maxTokens: toOptionalNumber(draftMaxTokens),
      })
      setFeedback({ type: 'success', message: 'Rascunho salvo com sucesso.' })
      setDirty(false)
      await refreshAfterMutation(selectedVersion.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao salvar rascunho.') })
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    if (!selectedVersion) return
    setValidating(true)
    setFeedback(null)
    setValidationResult(null)
    try {
      const result = await validateAiPromptVersion({
        versionId: selectedVersion.id,
        content: draftContent,
        modelName: draftModel,
        temperature: toOptionalNumber(draftTemperature),
        maxTokens: toOptionalNumber(draftMaxTokens),
        status: selectedVersion.status,
      })
      setValidationResult({ errors: result.errors ?? [], warnings: result.warnings ?? [] })
      setFeedback({
        type: result.ok ? 'success' : 'error',
        message: result.ok ? 'Validação concluída sem erros.' : 'Validação encontrou problemas — veja abaixo.',
      })
      await refreshAfterMutation(selectedVersion.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao validar a versão.') })
    } finally {
      setValidating(false)
    }
  }

  const handleRunDataset = async () => {
    if (!selectedVersion) return
    setRunningDataset(true)
    setFeedback(null)
    try {
      await runAiTestDataset({ promptVersionId: selectedVersion.id })
      setFeedback({
        type: 'success',
        message: 'Execução do dataset concluída para esta versão. Veja o resultado em Validação IA.',
      })
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao executar o dataset de validação.') })
    } finally {
      setRunningDataset(false)
    }
  }

  const openPublishModal = () => {
    setForceOverride(false)
    setOverrideReason('')
    setPublishModalOpen(true)
  }

  const handlePublish = async () => {
    if (!selectedVersion) return
    setPublishing(true)
    setFeedback(null)
    try {
      const result = await publishAiPromptVersion({
        versionId: selectedVersion.id,
        forceOverride: forceOverride || undefined,
        overrideReason: overrideReason.trim() || undefined,
        validationRunId: selectedVersion.validationRunId ?? undefined,
      })
      setFeedback({
        type: 'success',
        message: `Versão v${result.version.versionNumber} publicada com sucesso.`,
      })
      setPublishModalOpen(false)
      await refreshAfterMutation(result.version.id)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao publicar a versão.') })
    } finally {
      setPublishing(false)
    }
  }

  const openRollbackModal = () => {
    setRollbackReason('')
    setRollbackModalOpen(true)
  }

  const handleRollback = async () => {
    if (!selectedVersion || !rollbackReason.trim()) return
    setRollingBack(true)
    setFeedback(null)
    try {
      const result = await rollbackAiPromptVersion({
        targetVersionId: selectedVersion.id,
        reason: rollbackReason.trim(),
      })
      setFeedback({
        type: 'success',
        message: `Rollback realizado — nova versão v${result.versionNumber} publicada.`,
      })
      setRollbackModalOpen(false)
      await refreshAfterMutation(result.promptVersionId)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao reverter a versão.') })
    } finally {
      setRollingBack(false)
    }
  }

  const openCompare = () => {
    setCompareResult(null)
    setCompareError(null)
    setCompareAId(activeVersion?.id ?? versions[0]?.id ?? '')
    setCompareBId(selectedVersion?.id ?? versions[1]?.id ?? '')
    setCompareOpen(true)
  }

  const handleCompare = async () => {
    if (!compareAId || !compareBId || compareAId === compareBId) return
    setComparing(true)
    setCompareError(null)
    try {
      const result = await compareAiPromptVersions(compareAId, compareBId)
      setCompareResult(result)
    } catch (err) {
      setCompareResult(null)
      setCompareError(getErrorMessage(err, 'Falha ao comparar as versões selecionadas.'))
    } finally {
      setComparing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Prompts da IA"
        description="Governança de versões dos prompts utilizados pela Consulta IA e validações"
        actions={
          selectedDefinitionId && (
            <Button variant="outline" onClick={openCompare} disabled={versions.length < 2}>
              <GitCompareArrows size={16} />
              Comparar
            </Button>
          )
        }
      />

      {feedback && (
        <p
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card title="Prompts" subtitle="Definições cadastradas" className="!p-0 h-fit">
          {definitionsLoading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando…</div>
          ) : definitionsError ? (
            <div className="px-4 py-4 text-sm text-red-700">{definitionsError}</div>
          ) : definitions.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nenhum prompt cadastrado"
              description="Cadastre uma definição de prompt no banco de dados."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {definitions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDefinitionId(d.id)}
                    className={`block w-full px-4 py-3 text-left text-sm transition ${
                      selectedDefinitionId === d.id ? 'bg-slate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{d.name}</p>
                      {!d.active && <Badge variant="default">Inativo</Badge>}
                    </div>
                    <p className="font-mono text-xs text-slate-500">{d.code}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {!selectedDefinitionId ? (
            <Card>
              <EmptyState
                icon={ScrollText}
                title="Selecione um prompt"
                description="Escolha uma definição na lista para ver suas versões."
              />
            </Card>
          ) : (
            <>
              <Card title="Versão publicada ativa">
                {detailLoading ? (
                  <p className="text-sm text-slate-500">Carregando…</p>
                ) : !activeVersion ? (
                  <p className="text-sm text-slate-500">Nenhuma versão publicada ainda.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-xs text-slate-500">Versão</p>
                      <p className="text-lg font-semibold text-slate-800">v{activeVersion.versionNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Modelo</p>
                      <p className="text-sm font-medium text-slate-800">{activeVersion.modelName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Temperatura</p>
                      <p className="text-sm font-medium text-slate-800">{activeVersion.temperature ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Máx. tokens</p>
                      <p className="text-sm font-medium text-slate-800">{activeVersion.maxTokens ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Hash</p>
                      <p className="font-mono text-xs text-slate-600">{shortHash(activeVersion.contentHash)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Score de validação</p>
                      <p className="text-sm font-medium text-slate-800">
                        {activeVersion.validationScore ?? '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-3 lg:col-span-6">
                      <p className="text-xs text-slate-500">Publicada em</p>
                      <p className="text-sm text-slate-700">{formatWhen(activeVersion.publishedAt)}</p>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Versões" subtitle="Rascunhos e histórico de publicações" className="overflow-x-auto !p-0">
                {detailLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando…</div>
                ) : detailError ? (
                  <div className="px-4 py-4 text-sm text-red-700">{detailError}</div>
                ) : versions.length === 0 ? (
                  <EmptyState icon={ScrollText} title="Nenhuma versão encontrada" />
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Versão</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Ambiente</th>
                        <th className="px-4 py-3 font-medium">Modelo</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Criada em</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {versions.map((v) => (
                        <tr
                          key={v.id}
                          className={`cursor-pointer hover:bg-slate-50 ${
                            selectedVersionId === v.id ? 'bg-slate-50' : ''
                          }`}
                          onClick={() => setSelectedVersionId(v.id)}
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">v{v.versionNumber}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(v.status)}>{statusLabel(v.status)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{v.environment}</td>
                          <td className="px-4 py-3">{v.modelName ?? '—'}</td>
                          <td className="px-4 py-3">{v.validationScore ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatWhen(v.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              className="!px-2 !py-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedVersionId(v.id)
                              }}
                            >
                              Ver detalhes
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card
                title={
                  selectedVersion
                    ? `Versão v${selectedVersion.versionNumber} — ${selectedDefinition?.name ?? ''}`
                    : 'Detalhe da versão'
                }
                subtitle={selectedVersion ? statusLabel(selectedVersion.status) : undefined}
              >
                {versionLoading ? (
                  <p className="text-sm text-slate-500">Carregando versão…</p>
                ) : !selectedVersion ? (
                  <EmptyState icon={ScrollText} title="Nenhuma versão selecionada" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>
                        Nunca inclua segredos, senhas, tokens ou chaves de API no conteúdo do prompt.
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        label="Modelo"
                        value={isDraft ? draftModel : selectedVersion.modelName ?? ''}
                        onChange={(e) => {
                          setDraftModel(e.target.value)
                          setDirty(true)
                        }}
                        disabled={!isDraft}
                        placeholder="Ex.: gpt-4.1-mini"
                      />
                      <Input
                        label="Temperatura"
                        type="number"
                        step="0.1"
                        value={isDraft ? draftTemperature : selectedVersion.temperature ?? ''}
                        onChange={(e) => {
                          setDraftTemperature(e.target.value)
                          setDirty(true)
                        }}
                        disabled={!isDraft}
                      />
                      <Input
                        label="Máx. tokens"
                        type="number"
                        value={isDraft ? draftMaxTokens : selectedVersion.maxTokens ?? ''}
                        onChange={(e) => {
                          setDraftMaxTokens(e.target.value)
                          setDirty(true)
                        }}
                        disabled={!isDraft}
                      />
                    </div>

                    <div>
                      <Textarea
                        label="Conteúdo do prompt"
                        value={isDraft ? draftContent : selectedVersion.content}
                        onChange={(e) => {
                          setDraftContent(e.target.value)
                          setDirty(true)
                        }}
                        readOnly={!isDraft}
                        disabled={!isDraft}
                        className="min-h-[280px] font-mono text-xs"
                      />
                      <p className="mt-1 text-right text-xs text-slate-500">
                        {(isDraft ? draftContent : selectedVersion.content).length} caracteres
                      </p>
                    </div>

                    {validationResult && (
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        {validationResult.errors.length === 0 && validationResult.warnings.length === 0 ? (
                          <p className="text-sm text-emerald-700">Nenhum problema encontrado.</p>
                        ) : (
                          <>
                            {validationResult.errors.map((e, i) => (
                              <p key={`err-${i}`} className="text-sm text-red-700">
                                ✕ {e}
                              </p>
                            ))}
                            {validationResult.warnings.map((w, i) => (
                              <p key={`warn-${i}`} className="text-sm text-amber-700">
                                ⚠ {w}
                              </p>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button variant="outline" onClick={() => void handleCreateVersion()} disabled={creating}>
                        <FilePlus2 size={16} />
                        {creating ? 'Criando…' : 'Nova versão'}
                      </Button>
                      {isDraft && (
                        <Button onClick={() => void handleSaveDraft()} disabled={saving || !dirty}>
                          <Save size={16} />
                          {saving ? 'Salvando…' : 'Salvar rascunho'}
                        </Button>
                      )}
                      {isDraft && (
                        <Button variant="secondary" onClick={() => void handleValidate()} disabled={validating}>
                          <ShieldCheck size={16} />
                          {validating ? 'Validando…' : 'Validar'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => void handleRunDataset()}
                        disabled={runningDataset}
                      >
                        <Rss size={16} />
                        {runningDataset ? 'Executando…' : 'Executar validação dataset'}
                      </Button>
                      {(isDraft || selectedVersion.status === 'VALIDATING') && (
                        <Button variant="primary" onClick={openPublishModal} disabled={publishing}>
                          <CheckCircle2 size={16} />
                          Publicar
                        </Button>
                      )}
                      {isArchived && (
                        <Button variant="danger" onClick={openRollbackModal} disabled={rollingBack}>
                          <RotateCcw size={16} />
                          Rollback
                        </Button>
                      )}
                      <Link
                        to="/ia/validacao"
                        className="ml-auto self-center text-sm font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
                      >
                        Ver histórico de execuções →
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal
        open={publishModalOpen}
        onClose={() => !publishing && setPublishModalOpen(false)}
        title="Publicar versão"
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishModalOpen(false)} disabled={publishing}>
              Cancelar
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing}>
              {publishing ? 'Publicando…' : 'Confirmar publicação'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {selectedVersion
              ? `Tornar a versão v${selectedVersion.versionNumber} a versão ativa desta definição?`
              : ''}
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={forceOverride}
              onChange={(e) => setForceOverride(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Forçar publicação (ignorar validação pendente)
          </label>
          <Textarea
            label="Motivo (opcional)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Justificativa para a publicação, se aplicável…"
          />
        </div>
      </Modal>

      <Modal
        open={rollbackModalOpen}
        onClose={() => !rollingBack && setRollbackModalOpen(false)}
        title="Reverter versão"
        footer={
          <>
            <Button variant="outline" onClick={() => setRollbackModalOpen(false)} disabled={rollingBack}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleRollback()}
              disabled={rollingBack || !rollbackReason.trim()}
            >
              {rollingBack ? 'Revertendo…' : 'Confirmar rollback'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {selectedVersion
              ? `Reverter para o conteúdo da versão v${selectedVersion.versionNumber}? Uma nova versão publicada será criada a partir dela.`
              : ''}
          </p>
          <Textarea
            label="Motivo (obrigatório)"
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            placeholder="Explique o motivo do rollback…"
          />
        </div>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparar versões"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => void handleCompare()}
              disabled={comparing || !compareAId || !compareBId || compareAId === compareBId}
            >
              {comparing ? 'Comparando…' : 'Comparar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Versão A</label>
              <select
                value={compareAId}
                onChange={(e) => setCompareAId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary,#0d4f8b)] focus:ring-2 focus:ring-[var(--color-primary,#0d4f8b)]/20"
              >
                <option value="">Selecione…</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} — {statusLabel(v.status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Versão B</label>
              <select
                value={compareBId}
                onChange={(e) => setCompareBId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary,#0d4f8b)] focus:ring-2 focus:ring-[var(--color-primary,#0d4f8b)]/20"
              >
                <option value="">Selecione…</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} — {statusLabel(v.status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {compareError && <p className="text-sm text-red-700">{compareError}</p>}

          {compareResult && (
            <div className="space-y-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-slate-600">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Métrica</th>
                    <th className="py-2 pr-3 font-medium">v{compareResult.versionA.versionNumber}</th>
                    <th className="py-2 pr-3 font-medium">v{compareResult.versionB.versionNumber}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Status</td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusVariant(compareResult.versionA.status)}>
                        {statusLabel(compareResult.versionA.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusVariant(compareResult.versionB.status)}>
                        {statusLabel(compareResult.versionB.status)}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Ambiente</td>
                    <td className="py-2 pr-3">{compareResult.versionA.environment}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.environment}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Modelo</td>
                    <td className="py-2 pr-3">{compareResult.versionA.modelName ?? '—'}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.modelName ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Temperatura</td>
                    <td className="py-2 pr-3">{compareResult.versionA.temperature ?? '—'}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.temperature ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Máx. tokens</td>
                    <td className="py-2 pr-3">{compareResult.versionA.maxTokens ?? '—'}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.maxTokens ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Score</td>
                    <td className="py-2 pr-3">{compareResult.versionA.validationScore ?? '—'}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.validationScore ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Caracteres</td>
                    <td className="py-2 pr-3">{compareResult.versionA.contentLength}</td>
                    <td className="py-2 pr-3">{compareResult.versionB.contentLength}</td>
                  </tr>
                </tbody>
              </table>

              {compareResult.parametersDiffKeys.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Parâmetros alterados:</span>
                  {compareResult.parametersDiffKeys.map((k) => (
                    <Badge key={k} variant="info">
                      {k}
                    </Badge>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Prévia de diferenças ({compareResult.diff.addedLines} adicionadas ·{' '}
                  {compareResult.diff.removedLines} removidas)
                </p>
                {compareResult.diff.preview.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma diferença nas linhas comparadas.</p>
                ) : (
                  <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
                    {compareResult.diff.preview.map((op, idx) => (
                      <div
                        key={idx}
                        className={`whitespace-pre-wrap rounded px-1.5 py-0.5 ${
                          op.type === 'added'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {op.type === 'added' ? '+ ' : '- '}
                        {op.line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
