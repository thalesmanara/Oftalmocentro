import { useCallback, useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { getAuditLogById, getAuditLogs } from '@/services/auditService'
import type { AuditFilters, AuditLog, AuditPagination } from '@/types'
import { formatDateTime } from '@/utils/document'
import { getErrorMessage } from '@/utils/apiError'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'

const PAGE_SIZE = 20

const defaultFilters: AuditFilters = {
  page: 1,
  pageSize: PAGE_SIZE,
  search: '',
  action: '',
  resourceType: '',
  success: '',
  dateFrom: '',
  dateTo: '',
}

function truncateRequestId(id: string, length = 8): string {
  if (id.length <= length) return id
  return `${id.slice(0, length)}…`
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null | undefined }) {
  if (!data || Object.keys(data).length === 0) return null
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium text-slate-700">{label}</h4>
      <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(defaultFilters)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<AuditPagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const loadLogs = useCallback(async (activeFilters: AuditFilters) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAuditLogs(activeFilters)
      setLogs(result.items)
      setPagination(result.pagination)
    } catch (err) {
      setLogs([])
      setError(getErrorMessage(err, 'Erro ao carregar registros de auditoria.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLogs(appliedFilters)
  }, [appliedFilters, loadLogs])

  const applyFilters = () => {
    setAppliedFilters({ ...filters, page: 1 })
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
  }

  const goToPage = (page: number) => {
    setAppliedFilters((prev) => ({ ...prev, page }))
  }

  const openDetail = async (log: AuditLog) => {
    setDetailOpen(true)
    setSelectedLog(log)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const full = await getAuditLogById(log.id)
      setSelectedLog(full)
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Erro ao carregar detalhes.'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelectedLog(null)
    setDetailError(null)
  }

  return (
    <div>
      <PageHeader title="Auditoria" description="Registro de ações realizadas no sistema" />

      <Card className="mb-4 !p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input
            label="Busca"
            placeholder="Texto livre…"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <Input
            label="Ação"
            placeholder="Ex.: Login"
            value={filters.action ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          />
          <Input
            label="Tipo de recurso"
            placeholder="Ex.: Documento"
            value={filters.resourceType ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, resourceType: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.success === '' || filters.success === undefined ? '' : String(filters.success)}
            onChange={(e) => {
              const value = e.target.value
              setFilters((f) => ({
                ...f,
                success: value === '' ? '' : value === 'true',
              }))
            }}
            options={[
              { value: '', label: 'Todos' },
              { value: 'true', label: 'Sucesso' },
              { value: 'false', label: 'Falha' },
            ]}
          />
          <Input
            label="De"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
          <Input
            label="Até"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={applyFilters} disabled={loading}>
            Filtrar
          </Button>
          <Button variant="outline" onClick={resetFilters} disabled={loading}>
            Limpar
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 !p-4 text-sm text-red-700">{error}</Card>
      )}

      <Card className="overflow-x-auto !p-0">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">Carregando registros…</div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum registro encontrado"
            description="Ajuste os filtros ou aguarde novas ações no sistema."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Data/Hora</th>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Recurso</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Request ID</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => void openDetail(log)}
                >
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.occurredAt)}</td>
                  <td className="px-4 py-3">{log.userName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span>{log.resourceType}</span>
                    {log.resourceId && (
                      <span className="ml-1 font-mono text-xs text-slate-500">({log.resourceId})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={log.success ? 'success' : 'danger'}>
                      {log.success ? 'Sucesso' : 'Falha'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" title={log.requestId}>
                    {truncateRequestId(log.requestId)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {log.durationMs != null ? `${log.durationMs} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{log.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      className="!px-2 !py-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        void openDetail(log)
                      }}
                    >
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!loading && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title="Detalhes da auditoria"
        footer={
          <Button variant="outline" onClick={closeDetail}>
            Fechar
          </Button>
        }
      >
        {detailLoading && !selectedLog ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : detailError ? (
          <p className="text-sm text-red-600">{detailError}</p>
        ) : selectedLog ? (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-slate-500">Data/Hora</dt>
              <dd>{formatDateTime(selectedLog.occurredAt)}</dd>
              <dt className="text-slate-500">Usuário</dt>
              <dd>{selectedLog.userName ?? '—'}</dd>
              <dt className="text-slate-500">Ação</dt>
              <dd>{selectedLog.action}</dd>
              <dt className="text-slate-500">Recurso</dt>
              <dd>
                {selectedLog.resourceType}
                {selectedLog.resourceId ? ` (${selectedLog.resourceId})` : ''}
              </dd>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge variant={selectedLog.success ? 'success' : 'danger'}>
                  {selectedLog.success ? 'Sucesso' : 'Falha'}
                </Badge>
              </dd>
              <dt className="text-slate-500">Request ID</dt>
              <dd className="break-all font-mono text-xs">{selectedLog.requestId}</dd>
              {selectedLog.method && (
                <>
                  <dt className="text-slate-500">Método</dt>
                  <dd>{selectedLog.method}</dd>
                </>
              )}
              {selectedLog.path && (
                <>
                  <dt className="text-slate-500">Path</dt>
                  <dd className="break-all font-mono text-xs">{selectedLog.path}</dd>
                </>
              )}
              {selectedLog.statusCode != null && (
                <>
                  <dt className="text-slate-500">Status HTTP</dt>
                  <dd>{selectedLog.statusCode}</dd>
                </>
              )}
              {selectedLog.durationMs != null && (
                <>
                  <dt className="text-slate-500">Duração</dt>
                  <dd>{selectedLog.durationMs} ms</dd>
                </>
              )}
              {selectedLog.ipAddress && (
                <>
                  <dt className="text-slate-500">IP</dt>
                  <dd className="font-mono text-xs">{selectedLog.ipAddress}</dd>
                </>
              )}
              {selectedLog.errorCode && (
                <>
                  <dt className="text-slate-500">Código de erro</dt>
                  <dd>{selectedLog.errorCode}</dd>
                </>
              )}
            </dl>
            {detailLoading && <p className="text-xs text-slate-500">Atualizando detalhes…</p>}
            <JsonBlock label="Antes" data={selectedLog.beforeData} />
            <JsonBlock label="Depois" data={selectedLog.afterData} />
            <JsonBlock label="Metadados" data={selectedLog.metadata} />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
