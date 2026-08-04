import { apiGet, apiPost, apiPut } from './api'

export type AiCacheStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiCacheMode = 'DISABLED' | 'SHADOW' | 'EXACT_ONLY' | 'NORMALIZED' | 'SEMANTIC'

export interface AiCacheConfiguration {
  mode?: AiCacheMode
  exactEnabled?: boolean
  normalizedEnabled?: boolean
  semanticEnabled?: boolean
  semanticThreshold?: number
  ttlSeconds?: number
  maxEntries?: number
  maxEntriesPerScope?: number
  cacheNegativeAnswers?: boolean
  cacheInsufficientContext?: boolean
  cacheConflictResponses?: boolean
  cacheSensitiveQueries?: boolean
  requireSameSources?: boolean
  requireSameDocumentVersions?: boolean
  requireSamePromptVersion?: boolean
  requireSameRetrievalVersion?: boolean
  requireSameContextVersion?: boolean
  requireSameModel?: boolean
  scopeMode?: 'USER' | 'PERMISSION_SET' | 'SECTOR' | 'GLOBAL_SAFE'
  cacheSchemaVersion?: string
  qdrantCollection?: string
  notes?: string
}

export interface AiCacheDefinition {
  id: string
  code: string
  purpose?: string
  description?: string | null
  active: boolean
  activeMode?: AiCacheMode | string
  activeVersionLabel?: string | null
  publishedVersion?: AiCacheVersionSummary | null
  draftCount?: number
  stats?: {
    entryCount?: number
    validCount?: number
    expiredCount?: number
    invalidatedCount?: number
  }
}

export interface AiCacheVersionSummary {
  id: string
  versionNumber: number
  versionLabel?: string
  mode?: AiCacheMode | string
  configuration?: AiCacheConfiguration
  publishedAt?: string | null
  validationScore?: number | null
  contentHash?: string | null
}

export interface AiCacheVersion {
  id: string
  versionNumber: number
  versionLabel: string
  status: AiCacheStatus
  mode: AiCacheMode
  configuration: AiCacheConfiguration
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

export async function getAiCacheDefinitions() {
  return apiGet<{ items: AiCacheDefinition[] }>('/webhook/system/ai-cache')
}

export async function getAiCacheDetail(params: { id?: string; versionId?: string }) {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<{
    definition: AiCacheDefinition
    versions: AiCacheVersion[]
    activeVersion?: AiCacheVersion | null
    version?: AiCacheVersion | null
  }>(`/webhook/system/ai-cache/detail${qs}`)
}

export async function createAiCacheVersion(input: {
  mode: AiCacheMode
  configuration: AiCacheConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPost<{ version: AiCacheVersion }>('/webhook/system/ai-cache/create', input)
}

export async function updateAiCacheVersion(input: {
  versionId: string
  mode?: AiCacheMode
  configuration: AiCacheConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPut<{ version: AiCacheVersion }>('/webhook/system/ai-cache/update', input)
}

export async function validateAiCacheVersion(input: {
  mode?: AiCacheMode
  configuration: AiCacheConfiguration
}) {
  return apiPost<{ ok: boolean; configuration?: AiCacheConfiguration; contentHash?: string; fields?: Array<{ field: string; message: string }> }>(
    '/webhook/system/ai-cache/validate',
    input,
  )
}

export async function publishAiCacheVersion(input: {
  versionId: string
  validationRunId?: string
  override?: boolean
  forceOverride?: boolean
  reason?: string
}) {
  return apiPost('/webhook/system/ai-cache/publish', {
    ...input,
    forceOverride: input.forceOverride ?? input.override,
  })
}

export async function rollbackAiCacheVersion(input: {
  versionId?: string
  targetVersionId?: string
  reason?: string
}) {
  const targetVersionId = input.targetVersionId || input.versionId
  return apiPost('/webhook/system/ai-cache/rollback', {
    targetVersionId,
    versionId: targetVersionId,
    reason: input.reason,
  })
}

export async function compareAiCache() {
  return apiGet('/webhook/system/ai-cache/compare')
}

export async function invalidateAiCache(input: {
  documentId?: string
  promptVersionId?: string
  contextConfigVersionId?: string
  retrievalConfigVersionId?: string
  all?: boolean
  reason?: string
}) {
  return apiPost('/webhook/system/ai-cache/invalidate', input)
}

export async function cleanupAiCache() {
  return apiPost('/webhook/system/ai-cache/cleanup', {})
}

export async function getAiCacheMetrics(params?: { days?: number }) {
  const qs = buildQuery({ days: params?.days ?? 7 })
  return apiGet<{
    activeMode?: string
    activeVersion?: string
    entries?: Record<string, number>
    dependencies?: Record<string, number>
    dependencyCoverageRate?: number
    daily?: Array<Record<string, number | string>>
  }>(`/webhook/system/ai-cache/metrics${qs}`)
}

export async function getAiCacheEntries(params?: {
  status?: string
  invalidationReason?: string
  scopeHashPrefix?: string
  limit?: number
}) {
  const qs = buildQuery({
    status: params?.status,
    invalidationReason: params?.invalidationReason,
    scopeHashPrefix: params?.scopeHashPrefix,
    limit: params?.limit ?? 50,
  })
  return apiGet<{ items: Array<Record<string, unknown>> }>(`/webhook/system/ai-cache/entries${qs}`)
}

export async function runAiCacheShadowValidation() {
  return apiPost('/webhook/system/ai-cache/run-shadow-validation', {})
}
