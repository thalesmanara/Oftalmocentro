import { useEffect, useState } from 'react'
import type { TablePreviewResponse, TablePreviewSheet } from '@/types'
import { getTabularPreview } from '@/services/documentsService'
import { Card } from '@/components/ui/Card'

interface SpreadsheetPreviewPanelProps {
  documentId: string
  versionId?: string | null
  sheetCount?: number | null
  tableRowCount?: number | null
  tableColumnCount?: number | null
  enabled?: boolean
}

export function SpreadsheetPreviewPanel({
  documentId,
  versionId,
  sheetCount,
  tableRowCount,
  tableColumnCount,
  enabled = true,
}: SpreadsheetPreviewPanelProps) {
  const [data, setData] = useState<TablePreviewResponse | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !documentId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void getTabularPreview(documentId, versionId)
      .then((res) => {
        if (cancelled) return
        setData(res)
        const names = Object.keys(res.preview || {})
        setActiveSheet(names[0] || res.sheets?.[0]?.sheetName || '')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Falha ao carregar preview da planilha.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [documentId, versionId, enabled])

  if (!enabled) return null

  const sheet: TablePreviewSheet | undefined = activeSheet
    ? data?.preview?.[activeSheet]
    : undefined
  const sheetNames = Object.keys(data?.preview || {})

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Planilha estruturada</h3>
          <p className="mt-1 text-xs text-slate-500">
            Preview limitado das primeiras linhas — arquivo completo não é carregado na tela.
          </p>
        </div>
        <dl className="flex flex-wrap gap-4 text-xs text-slate-600">
          <div>
            <dt className="text-slate-400">Abas</dt>
            <dd className="font-medium text-slate-800">{sheetCount ?? data?.sheetCount ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Linhas</dt>
            <dd className="font-medium text-slate-800">
              {tableRowCount ?? data?.tableRowCount ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Colunas</dt>
            <dd className="font-medium text-slate-800">
              {tableColumnCount ?? data?.tableColumnCount ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      {loading && <p className="text-sm text-slate-500">Carregando preview…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && sheetNames.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                activeSheet === name
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && sheet && (
        <div className="max-h-80 overflow-auto rounded border border-slate-200">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-500">
                  #
                </th>
                {(sheet.headers || []).map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-700"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sheet.rows || []).map((row) => (
                <tr key={row.rowNumber} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border-b border-slate-100 px-2 py-1 text-slate-400">
                    {row.rowNumber}
                  </td>
                  {(row.values || []).map((v, i) => (
                    <td
                      key={`${row.rowNumber}-${i}`}
                      className="border-b border-slate-100 px-2 py-1 text-slate-700"
                    >
                      {v || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && !sheet && (
        <p className="text-sm text-slate-500">Nenhum preview tabular disponível para esta versão.</p>
      )}
    </Card>
  )
}
