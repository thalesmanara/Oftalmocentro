import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, FileIcon, ArrowLeft, Download } from 'lucide-react'
import { getDocumentById, deleteDocument, downloadDocumentFile, runDocumentOcr } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import type { Category, Document, Sector } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { getCategoryNameById, getSectorNameById } from '@/utils/entities'
import { canAccessTechnicalAdministration } from '@/utils/permissions'
import {
  formatChecksumShort,
  formatDate,
  formatDateTime,
  formatDurationMs,
  formatFileSize,
  formatOcrQualityScore,
  extractionMethodLabel,
  friendlyProcessingStatusLabel,
  friendlyProcessingStatusVariant,
  getDocumentVigencyBadge,
  getFriendlyProcessingStatus,
  isSpreadsheetExtension,
  ocrModeLabel,
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
import { PermissionGuard } from '@/components/ui/PermissionGuard'
import { ModalConfirm } from '@/components/ui/Modal'
import { DocumentVersionsPanel } from '@/components/documents/DocumentVersionsPanel'
import { SpreadsheetPreviewPanel } from '@/components/documents/SpreadsheetPreviewPanel'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const { settings } = useSettings()
  const [flashError, setFlashError] = useState('')
  const handledLocationKey = useRef<string | null>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrMessage, setOcrMessage] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  useEffect(() => {
    if (handledLocationKey.current === location.key) return

    handledLocationKey.current = location.key
    const state = location.state as { errorMessage?: string } | null

    if (state?.errorMessage) {
      setFlashError(state.errorMessage)
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    setFlashError('')
  }, [id, location.key, location.pathname, location.state, navigate])

  const loadDocument = useCallback(() => {
    if (!id) return Promise.resolve()

    setLoading(true)
    setLoadError(null)
    return Promise.all([getDocumentById(id), getSectors(), getCategories()])
      .then(([document, s, c]) => {
        setDoc(document)
        setSectors(s)
        setCategories(c)
      })
      .catch((err) => {
        setDoc(null)
        setLoadError(getErrorMessage(err, 'Erro ao carregar documento.'))
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  const canEditDocument = hasPermission('editar_documentos')

  if (loading) {
    return <p className="text-slate-500">Carregando documento...</p>
  }

  if (loadError) {
    return (
      <div>
        <Link
          to="/documentos"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Voltar à biblioteca
        </Link>
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    )
  }

  if (!doc) {
    return (
      <div>
        <Link to="/documentos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Voltar à biblioteca
        </Link>
        <p className="text-slate-500">Documento não encontrado.</p>
      </div>
    )
  }

  const vigencyBadge = getDocumentVigencyBadge(doc)
  const canViewTechnical = canAccessTechnicalAdministration(user)
  const friendlyStatus = getFriendlyProcessingStatus(doc)
  const sectorLabel = doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)
  const categoryLabel = doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)
  const subcategoryLabel = doc.subcategoryName || 'Não informada'

  const handleDownload = async () => {
    if (!id) return

    setDownloading(true)
    setDownloadError(null)

    try {
      await downloadDocumentFile(id, doc.originalFileName ?? doc.fileName)
    } catch (err) {
      setDownloadError(getErrorMessage(err, 'Não foi possível baixar o arquivo.'))
    } finally {
      setDownloading(false)
    }
  }

  const handleRunOcr = async (force: boolean) => {
    if (!id) return
    setOcrRunning(true)
    setOcrError(null)
    setOcrMessage(null)
    try {
      const result = await runDocumentOcr(id, {
        versionId: doc.currentVersionId ?? undefined,
        force,
      })
      if (!result.ok) {
        setOcrError(result.message || result.code || 'Falha ao executar OCR.')
      } else {
        setOcrMessage(
          force
            ? `OCR reprocessado (${ocrStatusLabel(result.ocrStatus)}).`
            : `OCR executado (${ocrStatusLabel(result.ocrStatus)}).`
        )
        await loadDocument()
      }
    } catch (err) {
      setOcrError(getErrorMessage(err, 'Não foi possível executar o OCR.'))
    } finally {
      setOcrRunning(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !id) return

    setDeleting(true)
    try {
      await deleteDocument(id)
      setConfirmDelete(false)
      navigate('/documentos')
    } catch {
      // Mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {flashError && (
        <p className="mb-4 text-sm text-red-600">{flashError}</p>
      )}

      <Link to="/documentos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Voltar à biblioteca
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{doc.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="info">{sectorLabel}</Badge>
            <Badge>{categoryLabel}</Badge>
            {vigencyBadge.kind === 'expired' && <Badge variant="danger">{vigencyBadge.label}</Badge>}
            {vigencyBadge.kind === 'expiring' && <Badge variant="warning">{vigencyBadge.label}</Badge>}
            {vigencyBadge.kind === 'none' && <Badge variant="success">Em vigência</Badge>}
            {doc.isActive === false && <Badge variant="default">INATIVO</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard permission="editar_documentos">
            <Button variant="outline" onClick={() => navigate(`/documentos/${id}/editar`)}>
              <Pencil size={16} /> Editar
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="excluir_documentos">
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Excluir
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informações">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Descrição Semântica</dt>
              <dd className="mt-0.5 text-slate-800">{doc.semanticDescription}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Categoria</dt>
              <dd className="text-slate-800">{categoryLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Subcategoria</dt>
              <dd className="text-slate-800">{subcategoryLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Data de vigência</dt>
              <dd className="text-slate-800">{formatDate(doc.expirationDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-0.5">
                <Badge variant={doc.isActive === false ? 'default' : 'success'}>
                  {doc.isActive === false ? 'Inativo' : 'Ativo'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status de processamento</dt>
              <dd className="mt-0.5">
                <Badge variant={friendlyProcessingStatusVariant(friendlyStatus)}>
                  {friendlyProcessingStatusLabel(friendlyStatus)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="text-slate-800">{doc.responsibleUserName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cadastrado por</dt>
              <dd className="text-slate-800">{doc.createdByName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Atualizado por</dt>
              <dd className="text-slate-800">{doc.updatedByName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Data de cadastro</dt>
              <dd className="text-slate-800">{formatDateTime(doc.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Última atualização</dt>
              <dd className="text-slate-800">{formatDateTime(doc.updatedAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Arquivo">
          <div className="flex items-start gap-4">
            <FileIcon className="text-slate-400" size={40} />
            <div className="flex-1 space-y-2">
              <div>
                <p className="font-medium text-slate-800">
                  {doc.originalFileName ?? doc.fileName ?? '—'}
                </p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500">Tamanho</dt>
                    <dd className="text-slate-700">{formatFileSize(doc.fileSize)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500">Tipo</dt>
                    <dd className="text-slate-700">
                      {doc.detectedMimeType ?? doc.fileType ?? doc.browserMimeType ?? '—'}
                    </dd>
                  </div>
                  {doc.currentVersionNumber != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-slate-500">Versão atual</dt>
                      <dd className="text-slate-700">v{doc.currentVersionNumber}</dd>
                    </div>
                  )}

                  {canViewTechnical && (
                    <>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-slate-500">Checksum</dt>
                        <dd className="font-mono text-slate-700">
                          {formatChecksumShort(doc.checksum)}
                          {doc.checksumAlgorithm ? (
                            <span className="ml-1 font-sans text-slate-500">
                              ({doc.checksumAlgorithm})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <dt className="text-slate-500">Validação</dt>
                        <dd>
                          {doc.validationStatus ? (
                            <Badge variant={validationStatusVariant(doc.validationStatus)}>
                              {validationStatusLabel(doc.validationStatus)}
                            </Badge>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </dd>
                      </div>
                      {doc.validatedAt && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Validado em</dt>
                          <dd className="text-slate-700">{formatDateTime(doc.validatedAt)}</dd>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <dt className="text-slate-500">Status OCR</dt>
                        <dd>
                          {doc.ocrStatus ? (
                            <Badge variant={ocrStatusVariant(doc.ocrStatus)}>
                              {ocrStatusLabel(doc.ocrStatus)}
                            </Badge>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </dd>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <dt className="text-slate-500">Embedding</dt>
                        <dd>
                          {doc.embeddingStatus ? (
                            <Badge variant={embeddingStatusVariant(doc.embeddingStatus)}>
                              {embeddingStatusLabel(doc.embeddingStatus)}
                            </Badge>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </dd>
                      </div>
                      {doc.embeddingModel && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Modelo embedding</dt>
                          <dd className="text-slate-700">{doc.embeddingModel}</dd>
                        </div>
                      )}
                      {(doc.embeddingValidCount != null || doc.embeddingPendingCount != null) && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Chunks embedding</dt>
                          <dd className="text-slate-700">
                            {doc.embeddingValidCount ?? 0} válidos
                            {(doc.embeddingPendingCount ?? 0) > 0
                              ? ` · ${doc.embeddingPendingCount} pendentes`
                              : ''}
                            {(doc.embeddingFailedCount ?? 0) > 0
                              ? ` · ${doc.embeddingFailedCount} falhas`
                              : ''}
                          </dd>
                        </div>
                      )}
                      {doc.embeddingAvgMs != null && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Tempo embedding</dt>
                          <dd className="text-slate-700">{formatDurationMs(doc.embeddingAvgMs)}</dd>
                        </div>
                      )}
                      {doc.embeddingCompletedAt && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Embedding em</dt>
                          <dd className="text-slate-700">
                            {formatDateTime(doc.embeddingCompletedAt)}
                          </dd>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <dt className="text-slate-500">Vetorizado (Qdrant)</dt>
                        <dd>
                          {doc.qdrantSyncStatus ? (
                            <Badge variant={qdrantSyncStatusVariant(doc.qdrantSyncStatus)}>
                              {qdrantSyncStatusLabel(doc.qdrantSyncStatus)}
                            </Badge>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </dd>
                      </div>
                      {doc.qdrantCollection && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Coleção</dt>
                          <dd className="text-slate-700">{doc.qdrantCollection}</dd>
                        </div>
                      )}
                      {(doc.qdrantSyncedCount != null || doc.qdrantPendingCount != null) && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Pontos sync</dt>
                          <dd className="text-slate-700">
                            {doc.qdrantSyncedCount ?? 0} sincronizados
                            {(doc.qdrantPendingCount ?? 0) > 0
                              ? ` · ${doc.qdrantPendingCount} pendentes`
                              : ''}
                            {(doc.qdrantFailedCount ?? 0) > 0
                              ? ` · ${doc.qdrantFailedCount} falhas`
                              : ''}
                          </dd>
                        </div>
                      )}
                      {doc.qdrantSyncedAt && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Sincronizado em</dt>
                          <dd className="text-slate-700">{formatDateTime(doc.qdrantSyncedAt)}</dd>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <dt className="text-slate-500">Qualidade OCR</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                          {doc.ocrQualityGrade ? (
                            <Badge variant={ocrQualityGradeVariant(doc.ocrQualityGrade)}>
                              {ocrQualityGradeLabel(doc.ocrQualityGrade)}
                            </Badge>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                          <span className="text-slate-700">
                            {formatOcrQualityScore(doc.ocrQualityScore)}
                          </span>
                        </dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-slate-500">Método de extração</dt>
                        <dd className="text-slate-700">
                          {extractionMethodLabel(doc.extractionMethod)}
                        </dd>
                      </div>
                      {(doc.sheetCount != null || isSpreadsheetExtension(doc.fileExtension)) && (
                        <>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-slate-500">Abas</dt>
                            <dd className="text-slate-700">{doc.sheetCount ?? '—'}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-slate-500">Linhas / colunas</dt>
                            <dd className="text-slate-700">
                              {doc.tableRowCount ?? '—'} / {doc.tableColumnCount ?? '—'}
                            </dd>
                          </div>
                        </>
                      )}
                      {doc.ocrMode && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Modo OCR</dt>
                          <dd className="text-slate-700">{ocrModeLabel(doc.ocrMode)}</dd>
                        </div>
                      )}
                      {doc.ocrEngine && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Motor OCR</dt>
                          <dd className="text-slate-700">{doc.ocrEngine}</dd>
                        </div>
                      )}
                      {doc.ocrLanguages && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Idioma OCR</dt>
                          <dd className="text-slate-700">{doc.ocrLanguages}</dd>
                        </div>
                      )}
                      {doc.ocrDurationMs != null && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Tempo OCR</dt>
                          <dd className="text-slate-700">{formatDurationMs(doc.ocrDurationMs)}</dd>
                        </div>
                      )}
                      {doc.ocrReviewReason && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">Motivo da revisão</dt>
                          <dd className="text-slate-700">{doc.ocrReviewReason}</dd>
                        </div>
                      )}
                      {doc.hasOcrDerivedFile && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-slate-500">PDF OCR</dt>
                          <dd className="text-slate-700">
                            {doc.ocrDerivedFileName ?? 'Derivado disponível'}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(doc.originalFileName ?? doc.fileName) && (
                  <Button
                    size="sm"
                    className="text-white hover:opacity-90"
                    style={{ backgroundColor: settings.primaryColor }}
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download size={16} />
                    {downloading ? 'Baixando...' : 'Download do arquivo'}
                  </Button>
                )}
                <PermissionGuard permission="editar_documentos">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRunOcr(false)}
                    disabled={ocrRunning || (doc.fileExtension ?? '').toLowerCase() !== 'pdf'}
                  >
                    {ocrRunning ? 'Executando OCR...' : 'Executar OCR'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRunOcr(true)}
                    disabled={ocrRunning || (doc.fileExtension ?? '').toLowerCase() !== 'pdf'}
                  >
                    Reprocessar OCR
                  </Button>
                </PermissionGuard>
              </div>
              {downloadError && (
                <p className="mt-2 text-sm text-red-600">{downloadError}</p>
              )}
              {ocrError && <p className="mt-2 text-sm text-red-600">{ocrError}</p>}
              {ocrMessage && <p className="mt-2 text-sm text-emerald-700">{ocrMessage}</p>}
            </div>
          </div>
        </Card>

        {(doc.hasTablePreview ||
          doc.extractionMethod === 'tabular' ||
          isSpreadsheetExtension(doc.fileExtension)) && (
          <SpreadsheetPreviewPanel
            documentId={doc.id}
            versionId={doc.currentVersionId}
            sheetCount={doc.sheetCount}
            tableRowCount={doc.tableRowCount}
            tableColumnCount={doc.tableColumnCount}
            enabled
          />
        )}
      </div>

      <div className="mt-6">
        <DocumentVersionsPanel
          documentId={id ?? ''}
          canEdit={canEditDocument}
          canViewTechnical={canViewTechnical}
          onRestored={() => void loadDocument()}
        />
      </div>

      <ModalConfirm
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir documento"
        message={`Deseja excluir "${doc.title}"? O registro será removido da biblioteca (exclusão lógica).`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        danger
      />
    </div>
  )
}
