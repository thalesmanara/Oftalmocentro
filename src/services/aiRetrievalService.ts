import { apiGet, apiPost, apiPut } from './api'

/**
 * Etapa 20 — Governança de configuração de retrieval / re-ranking.
 */

export type AiRetrievalStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiRetrievalMode = 'TEXT_ONLY' | 'VECTOR_ONLY' | 'HYBRID' | 'HYBRID_RERANK'

export interface AiRetrievalConfiguration {
  mode?: AiRetrievalMode
  candidateLimit?: number
  finalLimit?: number
  maxChunksPerDocument?: number
  enableNeighbors?: boolean
  weights?: {
    semantic?: number
    lexical?: number
    hybridPrior?: number
  }
  boosts?: Record<string, number>
  penalties?: Record<string, number>
  normalization?: Record<string, string>
  notes?: string
}

export interface AiRetrievalDefinition {
  id: string
  code: string
  purpose?: string
  description?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  activeMode?: AiRetrievalMode | string
  activeVersionLabel?: string | null
  publishedVersion?: AiRetrievalVersionSummary | null
  draftCount?: number
  versionCount?: number
}

export interface AiRetrievalVersionSummary {
  id: string
  versionNumber: number
  versionLabel?: string
  mode?: AiRetrievalMode | string
  configuration?: AiRetrievalConfiguration
  publishedAt?: string | null
  validationScore?: number | null
  contentHash?: string | null
}

export interface AiRetrievalVersion {
  id: string
  retrievalConfigId?: string
  versionNumber: number
  versionLabel: string
  status: AiRetrievalStatus
  mode: AiRetrievalMode
  configuration: AiRetrievalConfiguration
  contentHash?: string | null
  validationRunId?: string | null
  validationScore?: number | null
  notes?: string | null
  createdAt: string
  publishedAt?: string | null
}

export interface AiRetrievalListResult {
  items: AiRetrievalDefinition[]
}

export interface AiRetrievalDetailResult {
  definition: AiRetrievalDefinition
  versions: AiRetrievalVersion[]
  activeVersion?: AiRetrievalVersion | null
  version?: AiRetrievalVersion | null
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

export async function getAiRetrievalDefinitions(): Promise<AiRetrievalListResult> {
  return apiGet<AiRetrievalListResult>('/webhook/system/ai-retrieval')
}

export async function getAiRetrievalDetail(params: {
  id?: string
  versionId?: string
}): Promise<AiRetrievalDetailResult> {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<AiRetrievalDetailResult>(`/webhook/system/ai-retrieval/detail${qs}`)
}

export async function createAiRetrievalVersion(input: {
  mode: AiRetrievalMode
  configuration: AiRetrievalConfiguration
  versionLabel?: string
  changeSummary?: string
  notes?: string
}): Promise<{ definition?: AiRetrievalDefinition; version: AiRetrievalVersion }> {
  return apiPost('/webhook/system/ai-retrieval/create', input)
}

export async function updateAiRetrievalVersion(input: {
  versionId: string
  mode?: AiRetrievalMode
  configuration?: AiRetrievalConfiguration
  versionLabel?: string
  notes?: string
}): Promise<{ version: AiRetrievalVersion }> {
  return apiPut('/webhook/system/ai-retrieval/update', input)
}

export async function validateAiRetrievalVersion(input: {
  versionId?: string
  mode?: AiRetrievalMode
  configuration?: AiRetrievalConfiguration
}): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
  return apiPost('/webhook/system/ai-retrieval/validate', input, { timeoutMs: 60000 })
}

export async function publishAiRetrievalVersion(input: {
  versionId: string
  forceOverride?: boolean
  overrideReason?: string
}): Promise<{ version: AiRetrievalVersion }> {
  return apiPost('/webhook/system/ai-retrieval/publish', input)
}

export async function rollbackAiRetrievalVersion(input: {
  targetVersionId: string
  reason: string
}): Promise<{ ok: boolean; version?: AiRetrievalVersion }> {
  return apiPost('/webhook/system/ai-retrieval/rollback', input)
}
