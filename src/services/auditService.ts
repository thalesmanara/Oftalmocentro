import { apiGet } from './api'
import type { AuditFilters, AuditListResult, AuditLog } from '@/types'

function buildAuditQuery(filters: AuditFilters = {}): string {
  const params = new URLSearchParams()

  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.pageSize != null) params.set('pageSize', String(filters.pageSize))
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.action) params.set('action', filters.action)
  if (filters.resourceType) params.set('resourceType', filters.resourceType)
  if (filters.resourceId) params.set('resourceId', filters.resourceId)
  if (filters.success !== '' && filters.success !== undefined) {
    params.set('success', String(filters.success))
  }
  if (filters.requestId) params.set('requestId', filters.requestId)
  if (filters.errorCode) params.set('errorCode', filters.errorCode)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.search) params.set('search', filters.search)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function getAuditLogs(filters: AuditFilters = {}): Promise<AuditListResult> {
  return apiGet<AuditListResult>(`/webhook/audit${buildAuditQuery(filters)}`)
}

export async function getAuditLogById(id: string): Promise<AuditLog> {
  return apiGet<AuditLog>(`/webhook/audit/detail?id=${encodeURIComponent(id)}`)
}
