import { apiGet, apiPost, apiPut } from './api'

/**
 * Etapa 17 — Governança de prompts da IA (versionamento, validação e publicação).
 * Campos em camelCase espelham as colunas de `ai_prompt_definitions` / `ai_prompt_versions`.
 */

export type AiPromptStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiPromptEnvironment = 'PRODUCTION' | 'STAGING' | string

export interface AiPromptDefinition {
  id: string
  code: string
  name: string
  description?: string | null
  purpose: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AiPromptVersion {
  id: string
  promptDefinitionId: string
  promptCode?: string | null
  purpose?: string | null
  versionNumber: number
  status: AiPromptStatus
  environment: AiPromptEnvironment
  content: string
  modelName: string
  temperature?: number | null
  maxTokens?: number | null
  topP?: number | null
  responseFormat?: Record<string, unknown> | null
  parameters?: Record<string, unknown>
  changeSummary?: string | null
  contentHash?: string | null
  validationRunId?: string | null
  validationScore?: number | null
  basedOnVersionId?: string | null
  createdBy?: string | null
  createdByName?: string | null
  createdAt: string
  publishedBy?: string | null
  publishedByName?: string | null
  publishedAt?: string | null
  archivedAt?: string | null
  metadata?: Record<string, unknown>
}

export interface AiPromptDefinitionsResult {
  items: AiPromptDefinition[]
}

export interface AiPromptDetailResult {
  definition: AiPromptDefinition
  versions: AiPromptVersion[]
  activeVersion?: AiPromptVersion | null
  version?: AiPromptVersion | null
}

export interface AiPromptCreateInput {
  promptDefinitionId?: string
  code?: string
  name?: string
  description?: string
  purpose?: string
  environment?: AiPromptEnvironment
  basedOnVersionId?: string
  content: string
  modelName: string
  temperature?: number
  maxTokens?: number
  topP?: number
  parameters?: Record<string, unknown>
  changeSummary?: string
}

export interface AiPromptCreateResult {
  definition: AiPromptDefinition
  version: AiPromptVersion
}

export interface AiPromptUpdateInput {
  versionId: string
  content?: string
  modelName?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  parameters?: Record<string, unknown>
  changeSummary?: string
}

export interface AiPromptUpdateResult {
  version: AiPromptVersion
}

export interface AiPromptValidateInput {
  versionId?: string
  content?: string
  modelName?: string
  temperature?: number
  maxTokens?: number
  parameters?: Record<string, unknown>
  status?: AiPromptStatus
}

export interface AiPromptValidateResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  version?: AiPromptVersion
}

export interface AiPromptPublishInput {
  versionId: string
  forceOverride?: boolean
  overrideReason?: string
  validationRunId?: string
}

export interface AiPromptPublishResult {
  definition: AiPromptDefinition
  version: AiPromptVersion
}

export interface AiPromptRollbackInput {
  targetVersionId: string
  reason: string
}

export interface AiPromptRollbackResult {
  ok: boolean
  promptVersionId: string
  promptDefinitionId: string
  promptCode?: string | null
  purpose?: string | null
  versionNumber: number
  status: AiPromptStatus
  environment: AiPromptEnvironment
  contentHash?: string | null
  publishedAt?: string | null
  modelName?: string | null
  basedOnVersionId?: string | null
  rolledBackFromPublishedId?: string | null
}

/** Resumo de versão retornado pela comparação — nunca inclui o conteúdo bruto. */
export interface AiPromptVersionSummary {
  id: string
  versionNumber: number
  status: AiPromptStatus
  environment: AiPromptEnvironment
  modelName?: string | null
  temperature?: number | null
  maxTokens?: number | null
  topP?: number | null
  contentHash?: string | null
  contentLength: number
  validationScore?: number | null
  publishedAt?: string | null
  promptCode?: string | null
  purpose?: string | null
}

export interface AiPromptDiffLine {
  type: 'added' | 'removed'
  line: string
}

export interface AiPromptCompareResult {
  ok: boolean
  versionA: AiPromptVersionSummary
  versionB: AiPromptVersionSummary
  parametersDiffKeys: string[]
  diff: {
    addedLines: number
    removedLines: number
    changedLines: number
    preview: AiPromptDiffLine[]
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** Lista as definições de prompt cadastradas (editar_configuracoes). */
export async function getAiPromptDefinitions(): Promise<AiPromptDefinitionsResult> {
  return apiGet<AiPromptDefinitionsResult>('/webhook/system/ai-prompts')
}

/** Detalhe por definição (id) ou por versão específica (versionId). */
export async function getAiPromptDetail(params: {
  id?: string
  versionId?: string
}): Promise<AiPromptDetailResult> {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<AiPromptDetailResult>(`/webhook/system/ai-prompts/detail${qs}`)
}

/** Cria uma nova versão (rascunho), opcionalmente clonando de uma versão base. */
export async function createAiPromptVersion(
  input: AiPromptCreateInput
): Promise<AiPromptCreateResult> {
  return apiPost<AiPromptCreateResult>('/webhook/system/ai-prompts/create', input)
}

/** Atualiza o conteúdo/metadados de uma versão em rascunho. */
export async function updateAiPromptVersion(
  input: AiPromptUpdateInput
): Promise<AiPromptUpdateResult> {
  return apiPut<AiPromptUpdateResult>('/webhook/system/ai-prompts/update', input)
}

/** Executa a validação estática (allowlist de modelo, limites, detecção de segredos). */
export async function validateAiPromptVersion(
  input: AiPromptValidateInput
): Promise<AiPromptValidateResult> {
  return apiPost<AiPromptValidateResult>('/webhook/system/ai-prompts/validate', input, {
    timeoutMs: 60000,
  })
}

/** Publica uma versão, tornando-a a versão ativa da definição/ambiente. */
export async function publishAiPromptVersion(
  input: AiPromptPublishInput
): Promise<AiPromptPublishResult> {
  return apiPost<AiPromptPublishResult>('/webhook/system/ai-prompts/publish', input)
}

/** Reverte a definição para uma versão anterior (clona como nova PUBLISHED). */
export async function rollbackAiPromptVersion(
  input: AiPromptRollbackInput
): Promise<AiPromptRollbackResult> {
  return apiPost<AiPromptRollbackResult>('/webhook/system/ai-prompts/rollback', input)
}

/** Compara duas versões de prompt (metadados + prévia de diferenças por linha). */
export async function compareAiPromptVersions(
  versionIdA: string,
  versionIdB: string
): Promise<AiPromptCompareResult> {
  const qs = buildQuery({ versionIdA, versionIdB })
  return apiGet<AiPromptCompareResult>(`/webhook/system/ai-prompts/compare${qs}`)
}
