import { apiGet, apiPost } from './api'
import type { BackupDashboard, BackupRun, BackupRunType } from '@/types'

type ApiBackupDashboard = {
  runs?: BackupRun[]
  items?: BackupRun[]
  summaryByType?: Record<string, Partial<BackupRun> & { backupType?: string }>
  lastByType?: Partial<Record<string, BackupRun | null>>
  limitations?: BackupDashboard['limitations']
  lastRestoreTest?: BackupRun | null
}

function normalizeDashboard(raw: ApiBackupDashboard): BackupDashboard {
  const items = raw.items ?? raw.runs ?? []
  const lastByType: BackupDashboard['lastByType'] = { ...(raw.lastByType || {}) }

  if (raw.summaryByType) {
    for (const [type, summary] of Object.entries(raw.summaryByType)) {
      lastByType[type] = {
        id: summary.id || `summary-${type}`,
        backupType: type,
        status: summary.status || 'STARTED',
        startedAt: summary.startedAt || summary.finishedAt || '',
        finishedAt: summary.finishedAt,
        fileName: summary.fileName,
        checksum: summary.checksum,
        fileSize: summary.fileSize,
        durationMs: summary.durationMs,
        storageLocation: summary.storageLocation,
      }
    }
  }

  const lastRestoreTest =
    raw.lastRestoreTest ??
    items.find((i) => i.backupType === 'RESTORE_TEST') ??
    lastByType?.RESTORE_TEST ??
    null

  return {
    items,
    lastByType,
    limitations: raw.limitations || {
      level: 'operational_local',
      pgDump: false,
      externalStorage: false,
      restoreTestIsolated: false,
      documentPacking: 'inventory_only',
      disasterRecovery: false,
    },
    lastRestoreTest,
  }
}

/** Lista status e execuções recentes de backup (editar_configuracoes). */
export async function getBackups(): Promise<BackupDashboard> {
  const raw = await apiGet<ApiBackupDashboard>('/webhook/system/backups')
  return normalizeDashboard(raw || {})
}

/** Dispara backup manual suportado pelo backend. */
export async function runBackup(type: BackupRunType = 'FULL'): Promise<unknown> {
  return apiPost<unknown>('/webhook/system/backups/run', { type })
}
