import { useEffect, useMemo, useState } from 'react'
import { BookOpen, FileWarning, Loader2 } from 'lucide-react'
import { fetchDocumentFileBlob } from '@/services/documentsService'
import { getErrorMessage } from '@/utils/apiError'
import { isSpreadsheetExtension } from '@/utils/document'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type ReaderKind = 'pdf' | 'docx' | 'doc' | 'spreadsheet' | 'text' | 'unsupported' | 'empty'

interface DocumentReaderPanelProps {
  documentId: string
  fileName?: string | null
  fileExtension?: string | null
  mimeType?: string | null
}

interface SheetView {
  name: string
  headers: string[]
  rows: string[][]
}

function resolveExtension(
  fileName?: string | null,
  fileExtension?: string | null,
  mimeType?: string | null
): string {
  const fromField = String(fileExtension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
  if (fromField) return fromField

  const base = String(fileName || '')
    .split(/[/\\]/)
    .pop()
  if (base && base.includes('.')) {
    return base.slice(base.lastIndexOf('.') + 1).toLowerCase()
  }

  const mime = String(mimeType || '').toLowerCase()
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx'
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel')) return 'xlsx'
  if (mime.includes('csv')) return 'csv'
  if (mime.includes('text/plain')) return 'txt'
  return ''
}

function resolveKind(extension: string): ReaderKind {
  if (!extension) return 'unsupported'
  if (extension === 'pdf') return 'pdf'
  if (extension === 'docx') return 'docx'
  if (extension === 'doc') return 'doc'
  if (isSpreadsheetExtension(extension) || extension === 'xls' || extension === 'xlsx') {
    return 'spreadsheet'
  }
  if (extension === 'txt') return 'text'
  return 'unsupported'
}

function parseDelimitedText(text: string, delimiter: string): SheetView {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ''))

  if (lines.length === 0) {
    return { name: 'Planilha', headers: [], rows: [] }
  }

  const parsed = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))
  const headers = parsed[0] ?? []
  const rows = parsed.slice(1)
  return { name: 'Planilha', headers, rows }
}

function workbookToSheets(
  workbook: { SheetNames: string[]; Sheets: Record<string, unknown> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utils: { sheet_to_json: (...args: any[]) => unknown }
): SheetView[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const matrix = utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as (string | number | boolean | null)[][]

    const normalized = matrix.map((row) =>
      (row || []).map((cell) => (cell == null ? '' : String(cell)))
    )
    const headerCount = Math.max(1, ...normalized.map((row) => row.length))
    const headers =
      normalized[0]?.length
        ? Array.from({ length: headerCount }, (_, i) => normalized[0]?.[i] || `Coluna ${i + 1}`)
        : Array.from({ length: headerCount }, (_, i) => `Coluna ${i + 1}`)
    const rows = normalized.slice(1).map((row) =>
      Array.from({ length: headerCount }, (_, i) => row[i] ?? '')
    )
    return { name, headers, rows }
  })
}

export function DocumentReaderPanel({
  documentId,
  fileName,
  fileExtension,
  mimeType,
}: DocumentReaderPanelProps) {
  const extension = useMemo(
    () => resolveExtension(fileName, fileExtension, mimeType),
    [fileName, fileExtension, mimeType]
  )
  const kind = resolveKind(extension)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [sheets, setSheets] = useState<SheetView[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!documentId || kind === 'empty') return

    let cancelled = false
    let createdUrl: string | null = null

    setLoading(true)
    setError(null)
    setHtmlContent(null)
    setTextContent(null)
    setSheets([])
    setActiveSheet('')
    setObjectUrl(null)

    void (async () => {
      try {
        const { blob, contentType } = await fetchDocumentFileBlob(documentId)
        if (cancelled) return

        if (!blob || blob.size === 0) {
          setError('Arquivo vazio ou indisponível para leitura.')
          return
        }

        if (kind === 'pdf') {
          const typed =
            blob.type && blob.type.includes('pdf')
              ? blob
              : new Blob([blob], { type: contentType || 'application/pdf' })
          createdUrl = URL.createObjectURL(typed)
          setObjectUrl(createdUrl)
          return
        }

        if (kind === 'docx') {
          const arrayBuffer = await blob.arrayBuffer()
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer })
          if (cancelled) return
          setHtmlContent(result.value || '<p>Documento sem conteúdo legível.</p>')
          return
        }

        if (kind === 'doc') {
          setError(
            'Pré-visualização de arquivos .doc legado não é suportada no navegador. Baixe o arquivo ou converta para .docx/.pdf.'
          )
          return
        }

        if (kind === 'text') {
          const text = await blob.text()
          if (cancelled) return
          setTextContent(text)
          return
        }

        if (kind === 'spreadsheet') {
          if (extension === 'csv' || extension === 'tsv') {
            const text = await blob.text()
            if (cancelled) return
            const sheet = parseDelimitedText(text, extension === 'tsv' ? '\t' : ',')
            setSheets([sheet])
            setActiveSheet(sheet.name)
            return
          }

          const arrayBuffer = await blob.arrayBuffer()
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(arrayBuffer, { type: 'array' }) as {
            SheetNames: string[]
            Sheets: Record<string, unknown>
          }
          if (cancelled) return
          const parsedSheets = workbookToSheets(workbook, XLSX.utils)
          setSheets(parsedSheets)
          setActiveSheet(parsedSheets[0]?.name || '')
          return
        }

        setError(
          'Este formato ainda não possui leitor integrado. Use o download para abrir o arquivo no aplicativo correspondente.'
        )
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Não foi possível carregar o documento para leitura.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [documentId, kind, extension, reloadKey])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const activeSheetData = sheets.find((sheet) => sheet.name === activeSheet) ?? sheets[0]
  const hasFile = Boolean(fileName || fileExtension || mimeType)

  if (!hasFile) {
    return (
      <Card
        title="Leitor do documento"
        subtitle="Nenhum arquivo anexado a este documento."
      >
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FileWarning size={18} />
          Faça o upload de um arquivo na edição para habilitar a leitura.
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Leitor do documento"
      subtitle="Visualização no navegador do arquivo atual. PDF, Word (.docx), Excel, CSV/TSV e TXT."
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <BookOpen size={16} className="text-slate-400" />
          <span className="font-medium text-slate-800">
            {fileName || `arquivo.${extension || 'bin'}`}
          </span>
          {extension ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-600">
              {extension}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Recarregar
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin text-[var(--color-primary,#0d4f8b)]" />
          Carregando visualização…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {!loading && !error && kind === 'pdf' && objectUrl && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <iframe
            title={`Leitor PDF — ${fileName || 'documento'}`}
            src={objectUrl}
            className="h-[70vh] w-full bg-white"
          />
        </div>
      )}

      {!loading && !error && kind === 'docx' && htmlContent && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-5">
          <div
            className="document-reader-html text-sm leading-relaxed text-slate-800 [&_a]:text-[var(--color-primary,#0d4f8b)] [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      )}

      {!loading && !error && kind === 'text' && textContent != null && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-100">
            {textContent || '(arquivo vazio)'}
          </pre>
        </div>
      )}

      {!loading && !error && kind === 'spreadsheet' && activeSheetData && (
        <div className="space-y-3">
          {sheets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  type="button"
                  onClick={() => setActiveSheet(sheet.name)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                    activeSheetData.name === sheet.name
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-500">
                    #
                  </th>
                  {activeSheetData.headers.map((header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-700"
                    >
                      {header || `Coluna ${index + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSheetData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, activeSheetData.headers.length) + 1}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      Planilha sem linhas de dados.
                    </td>
                  </tr>
                ) : (
                  activeSheetData.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/70">
                      <td className="border-b border-slate-100 px-2 py-1.5 text-slate-400">
                        {rowIndex + 1}
                      </td>
                      {activeSheetData.headers.map((_, colIndex) => (
                        <td
                          key={`cell-${rowIndex}-${colIndex}`}
                          className="border-b border-slate-100 px-2 py-1.5 text-slate-700"
                        >
                          {row[colIndex] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
