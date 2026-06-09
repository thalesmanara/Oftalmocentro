import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, FileIcon, ArrowLeft } from 'lucide-react'
import { getDocumentById, deleteDocument } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getTags } from '@/services/tagsService'
import { logAction } from '@/services/auditService'
import type { Category, Document, Sector, Tag } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getCategoryNameById, getSectorNameById, getTagsByIds } from '@/utils/entities'
import { TagBadge } from '@/components/ui/TagBadge'
import { formatDate, formatDateTime, formatFileSize, isDocumentExpired } from '@/utils/document'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/ui/PermissionGuard'
import { ModalConfirm } from '@/components/ui/Modal'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doc, setDoc] = useState<Document | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (id) void getDocumentById(id).then(setDoc)
    void Promise.all([getSectors(), getCategories(), getTags()]).then(([s, c, t]) => {
      setSectors(s)
      setCategories(c)
      setTags(t)
    })
  }, [id])

  if (!doc) return <p className="text-slate-500">Carregando documento...</p>

  const expired = isDocumentExpired(doc)
  const sectorLabel = doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)
  const categoryLabel = doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)
  const resolvedTags = doc.tags?.length ? doc.tags : getTagsByIds(doc.tagIds, tags)

  const handleDelete = async () => {
    if (!user || !id) return
    await deleteDocument(id)
    logAction(user.name, 'Exclusão', 'Documento', `Documento "${doc.title}" excluído`)
    navigate('/documentos')
  }

  return (
    <div>
      <Link to="/documentos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Voltar à biblioteca
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{doc.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="info">{sectorLabel}</Badge>
            <Badge>{categoryLabel}</Badge>
            {expired ? <Badge variant="danger">Vencido</Badge> : <Badge variant="success">Válido</Badge>}
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
              <dt className="text-slate-500">Tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {resolvedTags.map((t) => <TagBadge key={t.id} tag={t} />)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Data de validade</dt>
              <dd className="text-slate-800">{formatDate(doc.expirationDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="text-slate-800">{doc.responsibleUserName ?? '—'}</dd>
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
            <div>
              <p className="font-medium text-slate-800">{doc.fileName ?? '—'}</p>
              <p className="text-sm text-slate-500">{formatFileSize(doc.fileSize)}</p>
              <p className="mt-1 text-xs text-slate-400">{doc.filePath}</p>
            </div>
          </div>
        </Card>

        <Card title="Texto extraído" className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{doc.extractedText ?? '—'}</p>
        </Card>
      </div>

      <ModalConfirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir documento"
        message={`Deseja excluir "${doc.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
