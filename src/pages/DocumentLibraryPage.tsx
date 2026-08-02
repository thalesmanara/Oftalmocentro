import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Eye, Pencil, Trash2, Plus, FileText } from 'lucide-react'
import { getDocuments, deleteDocument } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getSubcategories } from '@/services/subcategoriesService'
import type { Category, Document, Sector, Subcategory } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getCategoryNameById, getSectorNameById, getSubcategoryNameById } from '@/utils/entities'
import { formatDate, formatFileSize, isDocumentExpired } from '@/utils/document'
import { getErrorMessage } from '@/utils/apiError'
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
  const [error, setError] = useState<string | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [filterTitle, setFilterTitle] = useState('')
  const [filterSectorId, setFilterSectorId] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterSubcategoryId, setFilterSubcategoryId] = useState('')
  const [filterExpiration, setFilterExpiration] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDocuments()
      setDocuments(data)
    } catch (err) {
      setDocuments([])
      setError(getErrorMessage(err, 'Erro ao carregar documentos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void Promise.all([getSectors(), getCategories()])
      .then(([s, c]) => {
        setSectors(s)
        setCategories(c)
      })
      .catch(() => {
        setError((prev) => prev ?? 'Erro ao carregar filtros de setores/categorias.')
      })
  }, [])

  useEffect(() => {
    if (!filterCategoryId) {
      setSubcategories([])
      setFilterSubcategoryId('')
      setSubcategoriesError(null)
      return
    }

    let cancelled = false
    setLoadingSubcategories(true)
    setSubcategoriesError(null)

    void getSubcategories(filterCategoryId)
      .then((items) => {
        if (!cancelled) setSubcategories(items.filter((item) => item.active))
      })
      .catch((err) => {
        if (!cancelled) {
          setSubcategories([])
          setSubcategoriesError(getErrorMessage(err, 'Erro ao carregar subcategorias.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubcategories(false)
      })

    return () => {
      cancelled = true
    }
  }, [filterCategoryId])

  const handleCategoryFilterChange = (value: string) => {
    setFilterCategoryId(value)
    setFilterSubcategoryId('')
  }

  const sectorOptions = [
    { value: '', label: 'Todos os setores' },
    ...sectors.map((x) => ({ value: x.id, label: x.name })),
  ]
  const categoryOptions = [
    { value: '', label: 'Todas as categorias do documento' },
    ...categories.map((x) => ({ value: x.id, label: x.name })),
  ]
  const subcategoryOptions = !filterCategoryId
    ? [{ value: '', label: 'Selecione uma categoria' }]
    : loadingSubcategories
      ? [{ value: '', label: 'Carregando...' }]
      : subcategoriesError
        ? [{ value: '', label: 'Erro ao carregar' }]
        : [
            { value: '', label: 'Todas as subcategorias' },
            ...subcategories.map((x) => ({ value: x.id, label: x.name })),
          ]

  const displaySector = (doc: Document) =>
    doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)
  const displayCategory = (doc: Document) =>
    doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)
  const displaySubcategory = (doc: Document) =>
    doc.subcategoryName ??
    getSubcategoryNameById(doc.subcategoryId, subcategories, 'Não informada')

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filterTitle && !doc.title.toLowerCase().includes(filterTitle.toLowerCase())) return false
      if (filterSectorId && doc.sectorId !== filterSectorId) return false
      if (filterCategoryId && doc.categoryId !== filterCategoryId) return false
      if (filterSubcategoryId && doc.subcategoryId !== filterSubcategoryId) return false
      if (filterExpiration) {
        if (!doc.expirationDate) return false
        if (doc.expirationDate !== filterExpiration) return false
      }
      return true
    })
  }, [
    documents,
    filterTitle,
    filterSectorId,
    filterCategoryId,
    filterSubcategoryId,
    filterExpiration,
  ])

  const handleDelete = async () => {
    if (!deleteId || !user) return

    setDeleting(true)
    try {
      await deleteDocument(deleteId)
      setDeleteId(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir documento.'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando documentos...</p>
  }

  if (error && documents.length === 0) {
    return (
      <div>
        <PageHeader
          title="Biblioteca de documentos"
          description="Consulte e gerencie os documentos da clínica"
        />
        <Card>
          <p className="text-sm text-red-600">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    )
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

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {subcategoriesError && (
        <p className="mb-4 text-sm text-red-600">{subcategoriesError}</p>
      )}

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Input
            label="Título"
            placeholder="Buscar por título..."
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
          />
          <Select
            label="Setor"
            value={filterSectorId}
            onChange={(e) => setFilterSectorId(e.target.value)}
            options={sectorOptions}
          />
          <Select
            label="Categoria do documento"
            value={filterCategoryId}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            options={categoryOptions}
          />
          <Select
            label="Subcategoria"
            value={filterSubcategoryId}
            onChange={(e) => setFilterSubcategoryId(e.target.value)}
            options={subcategoryOptions}
            disabled={!filterCategoryId || loadingSubcategories}
          />
          <Input
            label="Data de vigência"
            type="date"
            value={filterExpiration}
            onChange={(e) => setFilterExpiration(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant={viewMode === 'cards' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid size={16} /> Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
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
                  {doc.subcategoryId || doc.subcategoryName
                    ? ` · ${displaySubcategory(doc)}`
                    : ''}
                </p>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{doc.semanticDescription}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Arquivo: {doc.fileName ?? '—'}
                  {doc.fileType ? ` · ${doc.fileType}` : ''}
                  {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Responsável: {doc.responsibleUserName ?? '—'} · Vigência:{' '}
                  {formatDate(doc.expirationDate)}
                </p>
                <div className="mt-4 flex gap-2">
                  {hasPermission('visualizar_documentos') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/documentos/${doc.id}`)}
                    >
                      <Eye size={14} /> Visualizar
                    </Button>
                  )}
                  {hasPermission('editar_documentos') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/documentos/${doc.id}/editar`)}
                    >
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
                <th className="px-4 py-3 font-medium">Categoria do documento</th>
                <th className="px-4 py-3 font-medium">Subcategoria</th>
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
                    <Link
                      to={`/documentos/${doc.id}`}
                      className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
                    >
                      {doc.title}
                    </Link>
                    {isDocumentExpired(doc) && (
                      <Badge variant="danger" className="ml-2">
                        Vigência expirada
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{displaySector(doc)}</td>
                  <td className="px-4 py-3">{displayCategory(doc)}</td>
                  <td className="px-4 py-3">{displaySubcategory(doc)}</td>
                  <td className="px-4 py-3">{formatDate(doc.expirationDate)}</td>
                  <td className="px-4 py-3">
                    {doc.fileName ?? '—'}
                    {doc.fileType ? (
                      <span className="block text-xs text-slate-400">{doc.fileType}</span>
                    ) : null}
                    {doc.fileSize ? (
                      <span className="block text-xs text-slate-400">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{doc.responsibleUserName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {hasPermission('visualizar_documentos') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/documentos/${doc.id}`)}
                        >
                          <Eye size={14} />
                        </Button>
                      )}
                      {hasPermission('editar_documentos') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/documentos/${doc.id}/editar`)}
                        >
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
