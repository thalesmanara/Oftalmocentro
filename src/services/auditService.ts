import { mockDelay } from './api'
import { mockAuditLogs } from '@/data/mocks'
import type { AuditLog } from '@/types'

export async function getAuditLogs(): Promise<AuditLog[]> {
  return mockDelay(
    [...mockAuditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  )
}

export async function addAuditLog(
  entry: Omit<AuditLog, 'id' | 'createdAt'>
): Promise<AuditLog> {
  const log: AuditLog = {
    ...entry,
    id: `audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  mockAuditLogs.unshift(log)
  return mockDelay(log)
}

export function logAction(
  userName: string,
  action: string,
  entity: string,
  details: string,
  ipAddress = '127.0.0.1'
): void {
  void addAuditLog({ userName, action, entity, details, ipAddress })
}
