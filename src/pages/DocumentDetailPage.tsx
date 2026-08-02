import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, FileIcon, ArrowLeft, Download } from 'lucide-react'
import { getDocumentById, deleteDocument, downloadDocumentFile } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import type { Category, Document, Sector } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { getCategoryNameById, getSectorNameById } from '@/utils/entities'
import { formatDate, formatDateTime, formatFileSize, isDocumentExpired } from '@/utils/document'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/ui/PermissionGuard'
import { ModalConfirm } from '@/components/ui/Modal'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings } = useSettings()
  const [flashError, setFlashError] = useState('')
  const handledLocationKey = useRef<string | null>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!id) return

    setLoading(true)
    void Promise.all([getDocumentById(id), getSectors(), getCategories()])
      .then(([document, s, c]) => {
        setDoc(document)
        setSectors(s)
        setCategories(c)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <p className="text-slate-500">Carregando documento...</p>
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

  const expired = isDocumentExpired(doc)
  const sectorLabel = doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)
  const categoryLabel = doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)
  const subcategoryLabel = doc.subcategoryName || 'Não informada'

  const handleDownload = async () => {
    if (!id) return

    setDownloading(true)
    setDownloadError(null)

    try {
      await downloadDocumentFile(id, doc.fileName)
    } catch {
      setDownloadError('Não foi possível baixar o arquivo.')
    } finally {
      setDownloading(false)
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
            {expired ? <Badge variant="danger">Vigência expirada</Badge> : <Badge variant="success">Em vigência</Badge>}
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
            <div className="flex-1">
              <p className="font-medium text-slate-800">{doc.fileName ?? '—'}</p>
              <p className="text-sm text-slate-500">{doc.fileType ?? '—'}</p>
              <p className="text-sm text-slate-500">{formatFileSize(doc.fileSize)}</p>
              {doc.fileName && (
                <Button
                  size="sm"
                  className="mt-4 text-white hover:opacity-90"
                  style={{ backgroundColor: settings.primaryColor }}
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  <Download size={16} />
                  {downloading ? 'Baixando...' : 'Download do arquivo'}
                </Button>
              )}
              {downloadError && (
                <p className="mt-2 text-sm text-red-600">{downloadError}</p>
              )}
            </div>
          </div>
        </Card>
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
