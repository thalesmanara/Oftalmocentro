import { apiGet, apiPost, apiPut } from './api'

export type AiEvidenceStatus = 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
export type AiEvidenceMode = 'DISABLED' | 'PASSTHROUGH' | 'STRUCTURED' | 'STRUCTURED_STRICT'

export interface AiEvidenceConfiguration {
  mode?: AiEvidenceMode
  enableEvidenceScore?: boolean
  enableClassification?: boolean
  enableConflictConsolidation?: boolean
  enableRedundancyDetection?: boolean
  enableRichSources?: boolean
  passthroughToCwm?: boolean
  minEvidenceScore?: number
  redundancyThreshold?: number
  dropBelowMinScore?: boolean
  notes?: string
}

export interface AiEvidenceDefinition {
  id: string
  code: string
  purpose?: string
  description?: string | null
  active: boolean
  activeMode?: AiEvidenceMode | string
  activeVersionLabel?: string | null
  publishedVersion?: AiEvidenceVersionSummary | null
  draftCount?: number
  versionCount?: number
}

export interface AiEvidenceVersionSummary {
  id: string
  versionNumber: number
  versionLabel?: string
  mode?: AiEvidenceMode | string
  configuration?: AiEvidenceConfiguration
  publishedAt?: string | null
  contentHash?: string | null
}

export interface AiEvidenceVersion {
  id: string
  versionNumber: number
  versionLabel: string
  status: AiEvidenceStatus
  mode: AiEvidenceMode
  configuration: AiEvidenceConfiguration
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

export async function getAiEvidenceDefinitions() {
  return apiGet<{ items: AiEvidenceDefinition[] }>('/webhook/system/ai-evidence')
}

export async function getAiEvidenceDetail(params: { id?: string; versionId?: string }) {
  const qs = buildQuery({ id: params.id, versionId: params.versionId })
  return apiGet<{
    definition: AiEvidenceDefinition
    versions: AiEvidenceVersion[]
    activeVersion?: AiEvidenceVersion | null
    version?: AiEvidenceVersion | null
  }>(`/webhook/system/ai-evidence/detail${qs}`)
}

export async function createAiEvidenceVersion(input: {
  mode: AiEvidenceMode
  configuration: AiEvidenceConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPost<{ version: AiEvidenceVersion }>('/webhook/system/ai-evidence/create', input)
}

export async function updateAiEvidenceVersion(input: {
  versionId: string
  mode?: AiEvidenceMode
  configuration: AiEvidenceConfiguration
  versionLabel?: string
  notes?: string
}) {
  return apiPut<{ version: AiEvidenceVersion }>('/webhook/system/ai-evidence/update', input)
}

export async function validateAiEvidenceVersion(input: {
  mode?: AiEvidenceMode
  configuration: AiEvidenceConfiguration
}) {
  return apiPost<{
    ok: boolean
    configuration?: AiEvidenceConfiguration
    errors?: Array<{ field: string; message: string }>
  }>('/webhook/system/ai-evidence/validate', input)
}

export async function publishAiEvidenceVersion(input: {
  versionId: string
  override?: boolean
  reason?: string
}) {
  return apiPost('/webhook/system/ai-evidence/publish', input)
}

export async function rollbackAiEvidenceVersion(input: {
  targetVersionId?: string
  versionId?: string
  reason?: string
}) {
  const targetVersionId = input.targetVersionId || input.versionId
  return apiPost('/webhook/system/ai-evidence/rollback', {
    targetVersionId,
    versionId: targetVersionId,
    reason: input.reason,
  })
}

export async function compareAiEvidence() {
  return apiGet('/webhook/system/ai-evidence/compare')
}
