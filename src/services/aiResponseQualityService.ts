import { apiGet, apiPost, apiPut } from './api'

export type AiResponseQualityStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiResponseQualityMode = 'DISABLED' | 'PASSTHROUGH' | 'VALIDATE' | 'VALIDATE_STRICT'

export interface AiResponsePolicyConfiguration {
  enabled?: boolean
  preserveOriginalAnswerOnAnswer?: boolean
  strategies?: Partial<
    Record<
      | 'ANSWER'
      | 'ANSWER_WITH_WARNING'
      | 'ANSWER_WITH_LIMITATION'
      | 'REQUEST_CLARIFICATION'
      | 'ABSTAIN'
      | 'DECLINE',
      boolean
    >
  >
  thresholds?: Record<string, boolean | number>
  phrases?: {
    abstain?: string
    limitationPrefix?: string
    conflictPrefix?: string
    clarificationPrefix?: string
    decline?: string
  }
  forbiddenExpressions?: string[]
}

export interface AiResponseQualityConfiguration {
  mode?: AiResponseQualityMode
  minAnswerLength?: number
  maxAnswerLength?: number
  requireSources?: boolean
  allowEmptyOnInsufficientContext?: boolean
  forbiddenPhrases?: string[]
  minQualityScoreWarn?: number
  minQualityScoreError?: number
  minCitationCoverage?: number
  enableHallucinationRules?: boolean
  enableConsistencyRules?: boolean
  enableSourceValidation?: boolean
  enableLengthRules?: boolean
  enableForbiddenPhrases?: boolean
  passthroughAnswer?: boolean
  notes?: string
  responsePolicy?: AiResponsePolicyConfiguration
}

export interface AiResponseQualityDefinition {
  id: string
  code: string
  purpose?: string
  description?: string | null
  active: boolean
  activeMode?: AiResponseQualityMode | string
  activeVersionLabel?: string | null
  publishedVersion?: AiResponseQualityVersionSummary | null
  draftCount?: number
  versionCount?: number
}

export interface AiResponseQualityVersionSummary {
  id: string
  versionNumber: number
  versionLabel?: string
  mode?: AiResponseQualityMode | string
  configuration?: AiResponseQualityConfiguration
  publishedAt?: string | null
  contentHash?: string | null
}

export interface AiResponseQualityVersion {
  id: string
  versionNumber: number
  versionLabel: string
  status: AiResponseQualityStatus
  mode: AiResponseQualityMode
  configuration: AiResponseQualityConfiguration
  contentHash?: string | null
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

export async function getAiResponseQualityDefinitions() {
  return apiGet<{ items: AiResponseQualityDefinition[] }>('/webhook/system/ai-response-quality')
}

export async function getAiResponseQualityDetail(params: { id?: string; versionId?: string }) {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<{
    definition: AiResponseQualityDefinition
    versions: AiResponseQualityVersion[]
    activeVersion?: AiResponseQualityVersion | null
    version?: AiResponseQualityVersion | null
  }>(`/webhook/system/ai-response-quality/detail${qs}`)
}

export async function createAiResponseQualityVersion(input: {
  mode: AiResponseQualityMode
  configuration: AiResponseQualityConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPost<{ version: AiResponseQualityVersion }>(
    '/webhook/system/ai-response-quality/create',
    input,
  )
}

export async function updateAiResponseQualityVersion(input: {
  versionId: string
  mode?: AiResponseQualityMode
  configuration: AiResponseQualityConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPut<{ version: AiResponseQualityVersion }>(
    '/webhook/system/ai-response-quality/update',
    input,
  )
}

export async function validateAiResponseQualityVersion(input: {
  mode?: AiResponseQualityMode
  configuration: AiResponseQualityConfiguration
}) {
  return apiPost<{
    ok: boolean
    configuration?: AiResponseQualityConfiguration
    errors?: Array<{ field: string; message: string }>
  }>('/webhook/system/ai-response-quality/validate', input)
}

export async function publishAiResponseQualityVersion(input: {
  versionId: string
  override?: boolean
  reason?: string
}) {
  return apiPost('/webhook/system/ai-response-quality/publish', input)
}

export async function rollbackAiResponseQualityVersion(input: {
  targetVersionId?: string
  versionId?: string
  reason?: string
}) {
  const targetVersionId = input.targetVersionId || input.versionId
  return apiPost('/webhook/system/ai-response-quality/rollback', {
    targetVersionId,
    versionId: targetVersionId,
    reason: input.reason,
  })
}

export async function compareAiResponseQuality() {
  return apiGet('/webhook/system/ai-response-quality/compare')
}
