import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Eye, Pencil, Trash2, Plus, FileText } from 'lucide-react'
import { getDocuments, deleteDocument } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getTags } from '@/services/tagsService'
import { logAction } from '@/services/auditService'
import type { Category, Document, Sector, Tag } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getCategoryNameById, getSectorNameById, getTagsByIds } from '@/utils/entities'
import { TagBadge } from '@/components/ui/TagBadge'
import { formatDate, formatFileSize, isDocumentExpired } from '@/utils/document'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PermissionGuard } from '@/components/ui/PermissionGuard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModalConfirm } from '@/components/ui/Modal'

type ViewMode = 'cards' | 'table'

export function DocumentLibraryPage() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [filterTitle, setFilterTitle] = useState('')
  const [filterSectorId, setFilterSectorId] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterTagId, setFilterTagId] = useState('')
  const [filterExpiration, setFilterExpiration] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getDocuments()
      setDocuments(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void Promise.all([getSectors(), getCategories(), getTags()]).then(([s, c, t]) => {
      setSectors(s)
      setCategories(c)
      setTags(t)
    })
  }, [])

  const sectorOptions = [
    { value: '', label: 'Todos os setores' },
    ...sectors.map((x) => ({ value: x.id, label: x.name })),
  ]
  const categoryOptions = [
    { value: '', label: 'Todas as categorias' },
    ...categories.map((x) => ({ value: x.id, label: x.name })),
  ]
  const tagOptions = [
    { value: '', label: 'Todas as tags' },
    ...tags.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name })),
  ]

  const displaySector = (doc: Document) =>
    doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)
  const displayCategory = (doc: Document) =>
    doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)
  const displayTags = (doc: Document) =>
    doc.tags?.length ? doc.tags : getTagsByIds(doc.tagIds, tags)

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filterTitle && !doc.title.toLowerCase().includes(filterTitle.toLowerCase())) return false
      if (filterSectorId && doc.sectorId !== filterSectorId) return false
      if (filterCategoryId && doc.categoryId !== filterCategoryId) return false
      if (filterTagId && !doc.tagIds.includes(filterTagId)) return false
      if (filterExpiration) {
        if (!doc.expirationDate) return false
        if (doc.expirationDate !== filterExpiration) return false
      }
      return true
    })
  }, [documents, filterTitle, filterSectorId, filterCategoryId, filterTagId, filterExpiration])

  const handleDelete = async () => {
    if (!deleteId || !user) return

    const doc = documents.find((d) => d.id === deleteId)
    setDeleting(true)
    try {
      await deleteDocument(deleteId)
      if (doc) logAction(user.name, 'Exclusão', 'Documento', `Documento "${doc.title}" excluído`)
      setDeleteId(null)
      await load()
    } catch {
      // Mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando documentos...</p>
  }

  return (
    <div>
      <PageHeader
        title="Biblioteca de documentos"
        description="Consulte e gerencie os documentos da clínica"
        actions={
          <PermissionGuard permission="cadastrar_documentos">
            <Button onClick={() => navigate('/documentos/novo')}>
              <Plus size={16} />
              Novo documento
            </Button>
          </PermissionGuard>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Input
            label="Título"
            placeholder="Buscar por título..."
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
          />
          <Select label="Setor" value={filterSectorId} onChange={(e) => setFilterSectorId(e.target.value)} options={sectorOptions} />
          <Select label="Categoria" value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)} options={categoryOptions} />
          <Select label="Tag" value={filterTagId} onChange={(e) => setFilterTagId(e.target.value)} options={tagOptions} />
          <Input label="Data de vigência" type="date" value={filterExpiration} onChange={(e) => setFilterExpiration(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant={viewMode === 'cards' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
            <LayoutGrid size={16} /> Cards
          </Button>
          <Button variant={viewMode === 'table' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
            <List size={16} /> Tabela
          </Button>
        </div>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Nenhum documento cadastrado ainda." />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Nenhum documento encontrado" />
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="!p-0">
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 line-clamp-2">{doc.title}</h3>
                  {isDocumentExpired(doc) && <Badge variant="danger">Vigência expirada</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {displaySector(doc)} · {displayCategory(doc)}
                </p>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{doc.semanticDescription}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {displayTags(doc).map((t) => <TagBadge key={t.id} tag={t} />)}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Arquivo: {doc.fileName ?? '—'}
                  {doc.fileType ? ` · ${doc.fileType}` : ''}
                  {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Responsável: {doc.responsibleUserName ?? '—'} · Vigência: {formatDate(doc.expirationDate)}
                </p>
                <div className="mt-4 flex gap-2">
                  {hasPermission('visualizar_documentos') && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/documentos/${doc.id}`)}>
                      <Eye size={14} /> Visualizar
                    </Button>
                  )}
                  {hasPermission('editar_documentos') && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/documentos/${doc.id}/editar`)}>
                      <Pencil size={14} />
                    </Button>
                  )}
                  {hasPermission('excluir_documentos') && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(doc.id)}>
                      <Trash2 size={14} className="text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Setor</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Vigência</th>
                <th className="px-4 py-3 font-medium">Arquivo</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/documentos/${doc.id}`} className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline">
                      {doc.title}
                    </Link>
                    {isDocumentExpired(doc) && <Badge variant="danger" className="ml-2">Vigência expirada</Badge>}
                  </td>
                  <td className="px-4 py-3">{displaySector(doc)}</td>
                  <td className="px-4 py-3">{displayCategory(doc)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {displayTags(doc).map((t) => <TagBadge key={t.id} tag={t} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(doc.expirationDate)}</td>
                  <td className="px-4 py-3">
                    {doc.fileName ?? '—'}
                    {doc.fileType ? (
                      <span className="block text-xs text-slate-400">{doc.fileType}</span>
                    ) : null}
                    {doc.fileSize ? (
                      <span className="block text-xs text-slate-400">{formatFileSize(doc.fileSize)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{doc.responsibleUserName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {hasPermission('visualizar_documentos') && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/documentos/${doc.id}`)}>
                          <Eye size={14} />
                        </Button>
                      )}
                      {hasPermission('editar_documentos') && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/documentos/${doc.id}/editar`)}>
                          <Pencil size={14} />
                        </Button>
                      )}
                      {hasPermission('excluir_documentos') && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(doc.id)}>
                          <Trash2 size={14} className="text-red-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ModalConfirm
        open={!!deleteId}
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir documento"
        message="Deseja excluir este documento? O registro será removido da biblioteca (exclusão lógica)."
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        danger
      />
    </div>
  )
}
