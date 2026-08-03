import { useCallback, useEffect, useState } from 'react'
import { Download, History, RotateCcw } from 'lucide-react'
import {
  downloadDocumentVersion,
  getDocumentVersions,
  restoreDocumentVersion,
  runDocumentOcr,
} from '@/services/documentsService'
import type { DocumentVersion } from '@/types'
import {
  formatChecksumShort,
  formatDateTime,
  formatDurationMs,
  formatFileSize,
  formatOcrQualityScore,
  extractionMethodLabel,
  ocrQualityGradeLabel,
  ocrQualityGradeVariant,
  embeddingStatusLabel,
  embeddingStatusVariant,
  qdrantSyncStatusLabel,
  qdrantSyncStatusVariant,
  ocrStatusLabel,
  ocrStatusVariant,
  validationStatusLabel,
  validationStatusVariant,
} from '@/utils/document'
import { getErrorMessage } from '@/utils/apiError'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ModalConfirm } from '@/components/ui/Modal'

interface DocumentVersionsPanelProps {
  documentId: string
  canEdit: boolean
  onRestored?: () => void
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: 'Processando',
  READY: 'Pronto',
  FAILED: 'Falhou',
  ARCHIVED: 'Arquivado',
  CURRENT: 'Atual',
}

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PROCESSING: 'warning',
  READY: 'success',
  FAILED: 'danger',
  ARCHIVED: 'default',
  CURRENT: 'info',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  return STATUS_VARIANTS[status] ?? 'default'
}

export function DocumentVersionsPanel({
  documentId,
  canEdit,
  onRestored,
}: DocumentVersionsPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [ocrVersionId, setOcrVersionId] = useState<string | null>(null)

  const loadVersions = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return getDocumentVersions(documentId)
      .then((data) => {
        setVersions(data.sort((a, b) => b.versionNumber - a.versionNumber))
      })
      .catch((err) => {
        setVersions([])
        setLoadError(getErrorMessage(err, 'Erro ao carregar versões do documento.'))
      })
      .finally(() => setLoading(false))
  }, [documentId])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions])

  const handleDownload = async (version: DocumentVersion) => {
    setActionError(null)
    setDownloadingId(version.id)
    try {
      await downloadDocumentVersion(
        documentId,
        version.id,
        version.originalFileName ?? version.fileName ?? undefined
      )
    } catch (err) {
      setActionError(getErrorMessage(err, 'Não foi possível baixar a versão selecionada.'))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleRestore = async () => {
    if (!versionToRestore) return

    setRestoring(true)
    setActionError(null)
    try {
      await restoreDocumentVersion(documentId, versionToRestore.id)
      setVersionToRestore(null)
      await loadVersions()
      onRestored?.()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Não foi possível restaurar a versão selecionada.'))
    } finally {
      setRestoring(false)
    }
  }

  const handleOcr = async (version: DocumentVersion, force: boolean) => {
    setActionError(null)
    setOcrVersionId(version.id)
    try {
      const result = await runDocumentOcr(documentId, { versionId: version.id, force })
      if (!result.ok) {
        setActionError(result.message || result.code || 'Falha ao executar OCR.')
      } else {
        await loadVersions()
        onRestored?.()
      }
    } catch (err) {
      setActionError(getErrorMessage(err, 'Não foi possível executar o OCR.'))
    } finally {
      setOcrVersionId(null)
    }
  }

  return (
    <Card
      title="Histórico de versões"
      subtitle="Versões anteriores do arquivo enviado para este documento"
    >
      {loading && <p className="text-sm text-slate-500">Carregando versões...</p>}

      {!loading && loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && versions.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <History size={18} className="text-slate-400" />
          Nenhuma versão registrada para este documento.
        </div>
      )}

      {!loading && !loadError && versions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Versão</th>
                <th className="py-2 pr-3 font-medium">Arquivo</th>
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Autor</th>
                <th className="py-2 pr-3 font-medium">Tamanho</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Checksum</th>
                <th className="py-2 pr-3 font-medium">Validação</th>
                <th className="py-2 pr-3 font-medium">OCR</th>
                <th className="py-2 pr-3 font-medium">Embedding</th>
                <th className="py-2 pr-3 font-medium">Extração</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr
                  key={version.id}
                  className={`border-b border-slate-50 last:border-0 ${
                    version.isCurrent ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">
                        v{version.versionNumber}
                      </span>
                      {version.isCurrent && <Badge variant="info">Atual</Badge>}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {version.originalFileName ?? version.fileName ?? '—'}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">{formatDateTime(version.createdAt)}</td>
                  <td className="py-3 pr-3 text-slate-600">{version.createdByName ?? '—'}</td>
                  <td className="py-3 pr-3 text-slate-600">{formatFileSize(version.fileSize)}</td>
                  <td className="py-3 pr-3 text-slate-600">
                    {version.detectedMimeType ?? version.mimeType ?? version.browserMimeType ?? '—'}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-600">
                    {formatChecksumShort(version.checksum)}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="space-y-1">
                      {version.validationStatus ? (
                        <Badge variant={validationStatusVariant(version.validationStatus)}>
                          {validationStatusLabel(version.validationStatus)}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {version.validatedAt && (
                        <p className="text-xs text-slate-500">
                          {formatDateTime(version.validatedAt)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="space-y-1">
                      {version.ocrStatus ? (
                        <Badge variant={ocrStatusVariant(version.ocrStatus)}>
                          {ocrStatusLabel(version.ocrStatus)}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {version.ocrQualityGrade && (
                        <Badge variant={ocrQualityGradeVariant(version.ocrQualityGrade)}>
                          {ocrQualityGradeLabel(version.ocrQualityGrade)}{' '}
                          {formatOcrQualityScore(version.ocrQualityScore)}
                        </Badge>
                      )}
                      {version.ocrDurationMs != null && (
                        <p className="text-xs text-slate-500">
                          {formatDurationMs(version.ocrDurationMs)}
                          {version.ocrLanguages ? ` · ${version.ocrLanguages}` : ''}
                        </p>
                      )}
                      {version.ocrReviewReason && (
                        <p className="text-xs text-amber-700">{version.ocrReviewReason}</p>
                      )}
                      {version.ocrEngine && (
                        <p className="text-xs text-slate-500">{version.ocrEngine}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="space-y-1">
                      {version.embeddingStatus ? (
                        <Badge variant={embeddingStatusVariant(version.embeddingStatus)}>
                          {embeddingStatusLabel(version.embeddingStatus)}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {version.embeddingModel && (
                        <p className="text-xs text-slate-500">{version.embeddingModel}</p>
                      )}
                      {(version.embeddingValidCount != null ||
                        version.embeddingPendingCount != null) && (
                        <p className="text-xs text-slate-500">
                          {version.embeddingValidCount ?? 0} válidos
                          {(version.embeddingPendingCount ?? 0) > 0
                            ? ` · ${version.embeddingPendingCount} pend.`
                            : ''}
                          {(version.embeddingFailedCount ?? 0) > 0
                            ? ` · ${version.embeddingFailedCount} falha`
                            : ''}
                        </p>
                      )}
                      {version.embeddingAvgMs != null && (
                        <p className="text-xs text-slate-500">
                          {formatDurationMs(version.embeddingAvgMs)}
                          {version.embeddingCompletedAt
                            ? ` · ${formatDateTime(version.embeddingCompletedAt)}`
                            : ''}
                        </p>
                      )}
                      {version.qdrantSyncStatus ? (
                        <Badge variant={qdrantSyncStatusVariant(version.qdrantSyncStatus)}>
                          Qdrant: {qdrantSyncStatusLabel(version.qdrantSyncStatus)}
                        </Badge>
                      ) : null}
                      {version.qdrantCollection && (
                        <p className="text-xs text-slate-500">{version.qdrantCollection}</p>
                      )}
                      {version.qdrantSyncedAt && (
                        <p className="text-xs text-slate-500">
                          Sync {formatDateTime(version.qdrantSyncedAt)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    <div className="space-y-1">
                      <div>{extractionMethodLabel(version.extractionMethod)}</div>
                      {(version.sheetCount != null || version.tableRowCount != null) && (
                        <p className="text-xs text-slate-500">
                          {version.sheetCount ?? 0} aba(s) · {version.tableRowCount ?? 0} linhas ·{' '}
                          {version.tableColumnCount ?? 0} cols
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={statusVariant(version.status)}>
                      {statusLabel(version.status)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {(version.originalFileName ?? version.fileName) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(version)}
                          disabled={downloadingId === version.id}
                        >
                          <Download size={14} />
                          {downloadingId === version.id ? 'Baixando...' : 'Download'}
                        </Button>
                      )}
                      {canEdit && (version.fileExtension ?? '').toLowerCase() === 'pdf' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleOcr(version, true)}
                          disabled={ocrVersionId === version.id}
                        >
                          {ocrVersionId === version.id ? 'OCR...' : 'Reprocessar OCR'}
                        </Button>
                      )}
                      {canEdit && !version.isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVersionToRestore(version)}
                        >
                          <RotateCcw size={14} />
                          Restaurar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

      <ModalConfirm
        open={versionToRestore !== null}
        onClose={() => !restoring && setVersionToRestore(null)}
        onConfirm={handleRestore}
        title="Restaurar versão"
        message={
          versionToRestore
            ? `Deseja restaurar a versão v${versionToRestore.versionNumber} deste documento? A versão atual será mantida no histórico.`
            : ''
        }
        confirmLabel={restoring ? 'Restaurando...' : 'Restaurar'}
      />
    </Card>
  )
}
