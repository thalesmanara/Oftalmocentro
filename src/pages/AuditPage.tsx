import { useEffect, useState } from 'react'
import { getAuditLogs } from '@/services/auditService'
import type { AuditLog } from '@/types'
import { formatDateTime } from '@/utils/document'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    void getAuditLogs().then(setLogs)
  }, [])

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Registro de ações realizadas no sistema"
      />
      <Card className="overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Data/Hora</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Detalhes</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.dataHora)}</td>
                <td className="px-4 py-3">{log.usuario}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">{log.acao}</Badge>
                </td>
                <td className="px-4 py-3">{log.entidade}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{log.detalhes}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
