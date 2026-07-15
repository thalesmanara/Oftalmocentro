import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileText, ListTree } from 'lucide-react'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoriesService'
import {
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '@/services/subcategoriesService'
import type { Category, Subcategory } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

type Feedback = { type: 'success' | 'error'; message: string }

export function CategoriesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('gerenciar_categorias')

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [managingCategory, setManagingCategory] = useState<Category | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [subFormName, setSubFormName] = useState('')
  const [subFormDescription, setSubFormDescription] = useState('')
  const [subFormActive, setSubFormActive] = useState(true)
  const [savingSubcategory, setSavingSubcategory] = useState(false)
  const [deleteSubcategoryId, setDeleteSubcategoryId] = useState<string | null>(null)
  const [deletingSubcategory, setDeletingSubcategory] = useState(false)

  const showFeedback = (next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), 4000)
  }

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCategories()
      setCategories(data)
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao carregar categorias do documento.' })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSubcategories = useCallback(async (categoryId: string) => {
    setLoadingSubcategories(true)
    try {
      const data = await getSubcategories(categoryId)
      setSubcategories((prev) => {
        const byId = new Map(
          prev.filter((item) => item.categoryId === categoryId).map((item) => [item.id, item])
        )
        for (const item of data) {
          byId.set(item.id, item)
        }
        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      })
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao carregar subcategorias.' })
    } finally {
      setLoadingSubcategories(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormDescription('')
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setFormName(category.name)
    setFormDescription(category.description ?? '')
    setFormActive(category.active)
    setModalOpen(true)
  }

  const openManageSubcategories = (category: Category) => {
    setManagingCategory(category)
    void loadSubcategories(category.id)
  }

  const closeManageSubcategories = () => {
    setManagingCategory(null)
    setSubcategories([])
    setSubModalOpen(false)
    setEditingSubcategory(null)
  }

  const openCreateSubcategory = () => {
    setEditingSubcategory(null)
    setSubFormName('')
    setSubFormDescription('')
    setSubFormActive(true)
    setSubModalOpen(true)
  }

  const openEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory)
    setSubFormName(subcategory.name)
    setSubFormDescription(subcategory.description ?? '')
    setSubFormActive(subcategory.active)
    setSubModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Categoria do documento atualizada com sucesso.' })
      } else {
        await createCategory({
          name: formName.trim(),
          description: formDescription.trim() || null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Categoria do documento criada com sucesso.' })
      }
      setModalOpen(false)
      await loadCategories()
    } catch {
      showFeedback({
        type: 'error',
        message: editing ? 'Erro ao atualizar categoria do documento.' : 'Erro ao criar categoria do documento.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await deleteCategory(deleteId)
      setDeleteId(null)
      showFeedback({ type: 'success', message: 'Categoria do documento inativada com sucesso.' })
      await loadCategories()
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao inativar categoria do documento.' })
    } finally {
      setDeleting(false)
    }
  }

  const mergeSubcategories = (items: Subcategory[]) => {
    setSubcategories((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]))
      for (const item of items) {
        if (item.categoryId === managingCategory?.id) {
          byId.set(item.id, item)
        }
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    })
  }

  const handleSaveSubcategory = async () => {
    if (!managingCategory || !subFormName.trim()) return

    setSavingSubcategory(true)
    try {
      if (editingSubcategory) {
        const updated = await updateSubcategory(editingSubcategory.id, {
          categoryId: managingCategory.id,
          name: subFormName.trim(),
          description: subFormDescription.trim() || null,
          active: subFormActive,
        })
        mergeSubcategories([updated])
        showFeedback({ type: 'success', message: 'Subcategoria atualizada com sucesso.' })
      } else {
        const created = await createSubcategory({
          categoryId: managingCategory.id,
          name: subFormName.trim(),
          description: subFormDescription.trim() || null,
          active: subFormActive,
        })
        mergeSubcategories([created])
        showFeedback({ type: 'success', message: 'Subcategoria criada com sucesso.' })
      }
      setSubModalOpen(false)
      setEditingSubcategory(null)
      // Recarrega e mescla (o GET do n8n hoje pode devolver só 1 item)
      const refreshed = await getSubcategories(managingCategory.id)
      mergeSubcategories(refreshed)
    } catch {
      showFeedback({
        type: 'error',
        message: editingSubcategory ? 'Erro ao atualizar subcategoria.' : 'Erro ao criar subcategoria.',
      })
    } finally {
      setSavingSubcategory(false)
    }
  }

  const handleDeleteSubcategory = async () => {
    if (!deleteSubcategoryId || !managingCategory) return

    setDeletingSubcategory(true)
    try {
      await deleteSubcategory(deleteSubcategoryId)
      setDeleteSubcategoryId(null)
      showFeedback({ type: 'success', message: 'Subcategoria inativada com sucesso.' })
      await loadSubcategories(managingCategory.id)
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao inativar subcategoria.' })
    } finally {
      setDeletingSubcategory(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Categorias do documento"
        description="Gestão das categorias e subcategorias de documentos via n8n"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} />
              Nova categoria do documento
            </Button>
          ) : undefined
        }
      />

      {feedback && (
        <p
          className={`mb-4 text-sm ${
            feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Card className="overflow-x-auto !p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando categorias do documento...</p>
        ) : categories.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma categoria de documento encontrada" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Nome</th>
                <th className="px-4 py-3 font-medium w-[28%]">Descrição para IA</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                {canManage && (
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{category.name}</td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600">
                    <p className="truncate" title={category.description ?? undefined}>
                      {category.description ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={category.active ? 'success' : 'danger'}>
                      {category.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-nowrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!px-2"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => openEdit(category)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="!gap-1.5 whitespace-nowrap"
                          title="Gerenciar subcategorias"
                          aria-label="Gerenciar subcategorias"
                          onClick={() => openManageSubcategories(category)}
                        >
                          <ListTree size={14} />
                          Gerenciar subcategorias
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!px-2"
                          title="Excluir"
                          aria-label="Excluir"
                          onClick={() => setDeleteId(category.id)}
                        >
                          <Trash2 size={14} className="text-red-600" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Editar categoria do documento' : 'Nova categoria do documento'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <Textarea
            label="Descrição para orientação da IA"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-slate-500">
            Explique quais tipos de documentos pertencem a esta categoria do documento e quando a IA deve
            consultar esses documentos.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded"
            />
            Ativo
          </label>
        </div>
      </Modal>

      <Modal
        open={!!managingCategory}
        onClose={() => !savingSubcategory && !deletingSubcategory && closeManageSubcategories()}
        title={managingCategory ? `Subcategorias — ${managingCategory.name}` : 'Subcategorias'}
        footer={
          <Button variant="outline" onClick={closeManageSubcategories}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Categoria principal: <strong>{managingCategory?.name}</strong>
          </p>

          {canManage && (
            <Button size="sm" onClick={openCreateSubcategory}>
              <Plus size={14} />
              Nova subcategoria
            </Button>
          )}

          {loadingSubcategories ? (
            <p className="text-sm text-slate-500">Carregando subcategorias...</p>
          ) : subcategories.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma subcategoria cadastrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Descrição para IA</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {canManage && <th className="px-3 py-2 font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subcategories.map((subcategory) => (
                    <tr key={subcategory.id}>
                      <td className="px-3 py-2 font-medium">{subcategory.name}</td>
                      <td className="px-3 py-2 text-slate-600">{subcategory.description ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={subcategory.active ? 'success' : 'danger'}>
                          {subcategory.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditSubcategory(subcategory)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteSubcategoryId(subcategory.id)}
                            >
                              <Trash2 size={14} className="text-red-600" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={subModalOpen}
        onClose={() => !savingSubcategory && setSubModalOpen(false)}
        title={editingSubcategory ? 'Editar subcategoria' : 'Nova subcategoria'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSubModalOpen(false)}
              disabled={savingSubcategory}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSubcategory}
              disabled={savingSubcategory || !subFormName.trim()}
            >
              {savingSubcategory ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={subFormName}
            onChange={(e) => setSubFormName(e.target.value)}
            required
          />
          <Textarea
            label="Descrição para orientação da IA"
            value={subFormDescription}
            onChange={(e) => setSubFormDescription(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-slate-500">
            Explique quais tipos de documentos pertencem a esta subcategoria e quando a IA deve
            consultar esses documentos.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subFormActive}
              onChange={(e) => setSubFormActive(e.target.checked)}
              className="rounded"
            />
            Ativo
          </label>
        </div>
      </Modal>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Inativar categoria do documento"
        message="Deseja inativar esta categoria do documento? Ela permanecerá no sistema com status inativo."
        confirmLabel={deleting ? 'Inativando...' : 'Inativar'}
        danger
      />

      <ModalConfirm
        open={!!deleteSubcategoryId}
        onClose={() => !deletingSubcategory && setDeleteSubcategoryId(null)}
        onConfirm={handleDeleteSubcategory}
        title="Inativar subcategoria"
        message="Deseja inativar esta subcategoria? Ela permanecerá no sistema com status inativo."
        confirmLabel={deletingSubcategory ? 'Inativando...' : 'Inativar'}
        danger
      />
    </div>
  )
}
