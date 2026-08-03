import { apiGet, apiPost } from '@/services/api'
import { getSystemHealth, type SystemHealth } from '@/services/healthService'

export type QdrantReindexScope = 'chunk' | 'document' | 'version' | 'all'

export interface QdrantReindexInput {
  scope: QdrantReindexScope
  documentId?: string
  versionId?: string
  chunkId?: string
}

export interface QdrantAdminSnapshot {
  health: SystemHealth
  qdrant: SystemHealth['components']['qdrant']
}

export async function getQdrantAdminSnapshot(): Promise<QdrantAdminSnapshot> {
  const health = await getSystemHealth()
  return { health, qdrant: health.components.qdrant }
}

export async function reindexQdrant(input: QdrantReindexInput): Promise<unknown> {
  return apiPost('/webhook/system/qdrant/reindex', input, { timeoutMs: 120000 })
}

export async function getQdrantHealthComponent() {
  const health = await apiGet<SystemHealth>('/webhook/system/health')
  return health.components.qdrant
}
