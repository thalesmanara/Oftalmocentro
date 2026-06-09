import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoriesService'
import type { Category } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
      showFeedback({ type: 'error', message: 'Erro ao carregar categorias.' })
    } finally {
      setLoading(false)
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
        showFeedback({ type: 'success', message: 'Categoria atualizada com sucesso.' })
      } else {
        await createCategory({
          name: formName.trim(),
          description: formDescription.trim() || null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Categoria criada com sucesso.' })
      }
      setModalOpen(false)
      await loadCategories()
    } catch {
      showFeedback({
        type: 'error',
        message: editing ? 'Erro ao atualizar categoria.' : 'Erro ao criar categoria.',
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
      showFeedback({ type: 'success', message: 'Categoria inativada com sucesso.' })
      await loadCategories()
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao inativar categoria.' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Gestão de categorias de documentos via n8n"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} />
              Nova categoria
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
          <p className="p-8 text-center text-sm text-slate-500">Carregando categorias...</p>
        ) : categories.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma categoria encontrada" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 text-slate-600">{category.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={category.active ? 'success' : 'danger'}>
                      {category.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(category.id)}>
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
        title={editing ? 'Editar categoria' : 'Nova categoria'}
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
          <Input
            label="Descrição"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
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

      <ModalConfirm
        open={!!deleteId}
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Inativar categoria"
        message="Deseja inativar esta categoria? Ela permanecerá no sistema com status inativo."
        confirmLabel={deleting ? 'Inativando...' : 'Inativar'}
        danger
      />
    </div>
  )
}
