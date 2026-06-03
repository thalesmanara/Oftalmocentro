import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  Eye,
  Pencil,
  Trash2,
  Plus,
  FileText,
} from 'lucide-react'
import { getDocuments, deleteDocument } from '@/services/documentsService'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getTags } from '@/services/tagsService'
import { logAction } from '@/services/auditService'
import type { Document } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import {
  formatDate,
  formatFileSize,
  isDocumentExpired,
} from '@/utils/document'
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
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [filterTitulo, setFilterTitulo] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterValidade, setFilterValidade] = useState('')
  const [sectorOptions, setSectorOptions] = useState<{ value: string; label: string }[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([])
  const [tagOptions, setTagOptions] = useState<{ value: string; label: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = () => void getDocuments().then(setDocuments)

  useEffect(() => {
    load()
    void Promise.all([getSectors(), getCategories(), getTags()]).then(([s, c, t]) => {
      setSectorOptions([
        { value: '', label: 'Todos os setores' },
        ...s.map((x) => ({ value: x.nome, label: x.nome })),
      ])
      setCategoryOptions([
        { value: '', label: 'Todas as categorias' },
        ...c.map((x) => ({ value: x.nome, label: x.nome })),
      ])
      setTagOptions([
        { value: '', label: 'Todas as tags' },
        ...t.map((x) => ({ value: x.nome, label: x.nome })),
      ])
    })
  }, [])

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (filterTitulo && !doc.titulo.toLowerCase().includes(filterTitulo.toLowerCase())) return false
      if (filterSetor && doc.setor !== filterSetor) return false
      if (filterCategoria && doc.categoria !== filterCategoria) return false
      if (filterTag && !doc.tags.includes(filterTag)) return false
      if (filterValidade) {
        if (!doc.dataValidade) return false
        if (doc.dataValidade !== filterValidade) return false
      }
      return true
    })
  }, [documents, filterTitulo, filterSetor, filterCategoria, filterTag, filterValidade])

  const handleDelete = async () => {
    if (!deleteId || !user) return
    const doc = documents.find((d) => d.id === deleteId)
    await deleteDocument(deleteId)
    if (doc) logAction(user.nome, 'Exclusão', 'Documento', `Documento "${doc.titulo}" excluído`)
    setDeleteId(null)
    load()
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
            value={filterTitulo}
            onChange={(e) => setFilterTitulo(e.target.value)}
          />
          <Select label="Setor" value={filterSetor} onChange={(e) => setFilterSetor(e.target.value)} options={sectorOptions} />
          <Select label="Categoria" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} options={categoryOptions} />
          <Select label="Tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)} options={tagOptions} />
          <Input label="Data de validade" type="date" value={filterValidade} onChange={(e) => setFilterValidade(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant={viewMode === 'cards' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid size={16} />
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List size={16} />
            Tabela
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Nenhum documento encontrado" />
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="!p-0">
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 line-clamp-2">{doc.titulo}</h3>
                  {isDocumentExpired(doc) && <Badge variant="danger">Vencido</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{doc.setor} · {doc.categoria}</p>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{doc.descricaoSemantica}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Validade: {formatDate(doc.dataValidade)} · {formatFileSize(doc.tamanhoArquivo)}
                </p>
                <div className="mt-4 flex gap-2">
                  {hasPermission('visualizar_documentos') && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/documentos/${doc.id}`)}>
                      <Eye size={14} />
                      Visualizar
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
                <th className="px-4 py-3 font-medium">Validade</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/documentos/${doc.id}`} className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline">
                      {doc.titulo}
                    </Link>
                    {isDocumentExpired(doc) && (
                      <Badge variant="danger" className="ml-2">Vencido</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{doc.setor}</td>
                  <td className="px-4 py-3">{doc.categoria}</td>
                  <td className="px-4 py-3">{formatDate(doc.dataValidade)}</td>
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
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir documento"
        message="Deseja excluir este documento?"
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
