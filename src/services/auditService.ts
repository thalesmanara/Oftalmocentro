import { mockDelay } from './api'
import { mockAuditLogs } from '@/data/mocks'
import type { AuditLog, AuditAction } from '@/types'

// Futuro: GET ${API_BASE_URL}/audit

export async function getAuditLogs(): Promise<AuditLog[]> {
  return mockDelay(
    [...mockAuditLogs].sort(
      (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    )
  )
}

export async function addAuditLog(
  entry: Omit<AuditLog, 'id' | 'dataHora'>
): Promise<AuditLog> {
  const log: AuditLog = {
    ...entry,
    id: `audit-${Date.now()}`,
    dataHora: new Date().toISOString(),
  }
  mockAuditLogs.unshift(log)
  return mockDelay(log)
}

export function logAction(
  usuario: string,
  acao: AuditAction,
  entidade: string,
  detalhes: string,
  ip = '127.0.0.1'
): void {
  void addAuditLog({ usuario, acao, entidade, detalhes, ip })
}
