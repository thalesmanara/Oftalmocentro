import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getBackups, runBackup } from '@/services/backupService'
import type { BackupDashboard, BackupRun } from '@/types'
import { getErrorMessage } from '@/utils/apiError'

function formatBytes(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusTone(status?: string): string {
  switch (status) {
    case 'VERIFIED':
    case 'SUCCESS':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'FAILED':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'STARTED':
      return 'bg-slate-50 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function pickLast(dashboard: BackupDashboard | null, type: string): BackupRun | null {
  const fromMap = dashboard?.lastByType?.[type]
  if (fromMap) return fromMap
  return dashboard?.items?.find((i) => i.backupType === type) ?? null
}

function LastCard({ title, run }: { title: string; run: BackupRun | null }) {
  return (
    <div className="rounded-lg border border-slate-100 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {!run ? (
        <p className="mt-1 text-sm text-slate-400">Nenhuma execução registrada</p>
      ) : (
        <div className="mt-1 space-y-1 text-sm text-slate-600">
          <p>
            <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(run.status)}`}>
              {run.status}
            </span>
          </p>
          <p>Data: {formatWhen(run.finishedAt || run.startedAt)}</p>
          <p>Duração: {run.durationMs != null ? `${run.durationMs} ms` : '—'}</p>
          <p>Tamanho: {formatBytes(run.fileSize)}</p>
          <p>Checksum: {run.checksum || '—'}</p>
          <p>Arquivo: {run.fileName || '—'}</p>
        </div>
      )}
    </div>
  )
}

export function BackupPanel() {
  const [data, setData] = useState<BackupDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getBackups()
      setData(result)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar o status de backup.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRun = async () => {
    setRunning(true)
    setFeedback(null)
    setError(null)
    try {
      await runBackup('FULL')
      setFeedback('Backup operacional local iniciado e concluído pelo backend.')
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao executar backup.'))
    } finally {
      setRunning(false)
    }
  }

  const limitations = data?.limitations
  const canRun = true

  return (
    <Card
      title="Backup e recuperação"
      subtitle="Cópias operacionais locais — não constituem disaster recovery completo"
      className="mt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Nível atual:{' '}
          <span className="font-medium text-slate-800">
            {limitations?.level || 'operational_local'}
          </span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || running}>
            Atualizar
          </Button>
          {canRun && (
            <Button type="button" size="sm" onClick={() => void handleRun()} disabled={running || loading}>
              {running ? 'Executando…' : 'Executar backup'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {feedback && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {feedback}
        </p>
      )}

      {limitations && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Limitações detectadas</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              pg_dump:{' '}
              {limitations.pgDump ? 'disponível' : 'indisponível — exportação lógica JSON (PARTIAL)'}
            </li>
            <li>
              Armazenamento externo:{' '}
              {limitations.externalStorage ? 'configurado' : 'não configurado (cópia local apenas)'}
            </li>
            <li>
              Documentos:{' '}
              {limitations.documentPacking === 'inventory_only'
                ? 'inventário apenas (sem empacotar binários)'
                : String(limitations.documentPacking || '—')}
            </li>
            <li>
              Restore isolado:{' '}
              {limitations.restoreTestIsolated ? 'disponível' : 'pendente (requer ambiente separado)'}
            </li>
            <li>
              Disaster recovery:{' '}
              {limitations.disasterRecovery ? 'validado' : 'não validado'}
            </li>
          </ul>
        </div>
      )}

      {loading && !data ? (
        <p className="mt-4 text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <LastCard title="Último backup do banco" run={pickLast(data, 'DATABASE')} />
            <LastCard title="Último backup dos documentos" run={pickLast(data, 'DOCUMENT_FILES')} />
            <LastCard title="Último backup dos workflows" run={pickLast(data, 'N8N_WORKFLOWS')} />
            <LastCard title="Último backup completo" run={pickLast(data, 'FULL')} />
          </div>

          <div className="mt-4 rounded-lg border border-slate-100 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Último teste de restauração</p>
            {data?.lastRestoreTest ? (
              <p className="mt-1">
                {data.lastRestoreTest.status} · {formatWhen(data.lastRestoreTest.finishedAt)}
              </p>
            ) : (
              <p className="mt-1 text-slate-400">Nenhum RESTORE_TEST registrado (não executar em produção).</p>
            )}
          </div>

          {(data?.items?.length ?? 0) > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">Tamanho</th>
                    <th className="py-2 font-medium">Checksum</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.slice(0, 12).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                      <td className="py-2 pr-3">{item.backupType}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{formatWhen(item.finishedAt || item.startedAt)}</td>
                      <td className="py-2 pr-3">{formatBytes(item.fileSize)}</td>
                      <td className="py-2 font-mono text-xs">{item.checksum || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
