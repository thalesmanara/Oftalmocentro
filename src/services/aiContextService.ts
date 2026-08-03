import { apiGet, apiPost, apiPut } from './api'

export type AiContextStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiContextMode = 'LEGACY' | 'BUDGETED' | 'BUDGETED_WITH_NEIGHBORS'

export interface AiContextConfiguration {
  mode?: AiContextMode
  modelName?: string
  contextLimitTokens?: number
  maxInputTokens?: number
  reservedResponseTokens?: number
  reservedSystemTokens?: number
  safetyMarginTokens?: number
  maxChunks?: number
  maxChunksPerDocument?: number
  minChunkScore?: number
  enableNeighbors?: boolean
  maxNeighborsPerChunk?: number
  enableRedundancyRemoval?: boolean
  redundancyThreshold?: number
  enableConflictPreservation?: boolean
  tokenizer?: string
  notes?: string
}

export interface AiContextDefinition {
  id: string
  code: string
  purpose?: string
  description?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  activeMode?: AiContextMode | string
  activeVersionLabel?: string | null
  publishedVersion?: AiContextVersionSummary | null
  draftCount?: number
  versionCount?: number
}

export interface AiContextVersionSummary {
  id: string
  versionNumber: number
  versionLabel?: string
  mode?: AiContextMode | string
  configuration?: AiContextConfiguration
  publishedAt?: string | null
  validationScore?: number | null
  contentHash?: string | null
}

export interface AiContextVersion {
  id: string
  contextConfigId?: string
  versionNumber: number
  versionLabel: string
  status: AiContextStatus
  mode: AiContextMode
  modelName?: string | null
  configuration: AiContextConfiguration
  contentHash?: string | null
  validationRunId?: string | null
  validationScore?: number | null
  notes?: string | null
  createdAt: string
  publishedAt?: string | null
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

export async function getAiContextDefinitions() {
  return apiGet<{ items: AiContextDefinition[] }>('/webhook/system/ai-context')
}

export async function getAiContextDetail(params: { id?: string; versionId?: string }) {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<{
    definition: AiContextDefinition
    versions: AiContextVersion[]
    activeVersion?: AiContextVersion | null
    version?: AiContextVersion | null
  }>(`/webhook/system/ai-context/detail${qs}`)
}

export async function createAiContextVersion(input: {
  mode: AiContextMode
  configuration: AiContextConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPost<{ version: AiContextVersion }>('/webhook/system/ai-context/create', input)
}

export async function updateAiContextVersion(input: {
  versionId: string
  mode?: AiContextMode
  configuration?: AiContextConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPut<{ version: AiContextVersion }>('/webhook/system/ai-context/update', input)
}

export async function validateAiContextVersion(input: {
  versionId?: string
  mode?: AiContextMode
  configuration?: AiContextConfiguration
  versionLabel?: string
}) {
  return apiPost<{ ok: boolean; errors?: Array<{ field: string; message: string }> }>(
    '/webhook/system/ai-context/validate',
    input,
  )
}

export async function publishAiContextVersion(input: {
  versionId: string
  override?: boolean
  forceOverride?: boolean
  reason?: string
  overrideReason?: string
  validationRunId?: string
}) {
  return apiPost('/webhook/system/ai-context/publish', {
    versionId: input.versionId,
    override: input.override,
    forceOverride: input.forceOverride ?? input.override,
    reason: input.reason,
    overrideReason: input.overrideReason ?? input.reason,
    validationRunId: input.validationRunId,
  })
}

export async function rollbackAiContextVersion(input: {
  versionId?: string
  targetVersionId?: string
  reason?: string
}) {
  const targetVersionId = input.targetVersionId || input.versionId
  return apiPost('/webhook/system/ai-context/rollback', {
    targetVersionId,
    versionId: targetVersionId,
    reason: input.reason,
  })
}

export interface AiContextCompareResult {
  runA: { id: string; status?: string; metrics?: Record<string, unknown> }
  runB: { id: string; status?: string; metrics?: Record<string, unknown> }
  differences?: Record<string, number | null>
  gains?: Array<{ metric: string; delta: number }>
  regressions?: Array<{ metric: string; delta: number }>
  criticalCases?: unknown[]
  verdict: 'IMPROVED' | 'NEUTRAL' | 'REGRESSED' | 'INCONCLUSIVE' | string
}

export async function compareAiContextRuns(runAId: string, runBId: string) {
  const qs = buildQuery({ runAId, runBId })
  return apiGet<AiContextCompareResult>(`/webhook/system/ai-context/compare${qs}`)
}
