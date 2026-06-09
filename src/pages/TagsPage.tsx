import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tags as TagsIcon } from 'lucide-react'
import { getTags, createTag, updateTag, deleteTag } from '@/services/tagsService'
import type { Tag } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagBadge } from '@/components/ui/TagBadge'

type Feedback = { type: 'success' | 'error'; message: string }

export function TagsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('gerenciar_tags')

  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#2563eb')
  const [formActive, setFormActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const showFeedback = (next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), 4000)
  }

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTags()
      setTags(data)
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao carregar tags.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormColor('#2563eb')
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (tag: Tag) => {
    setEditing(tag)
    setFormName(tag.name)
    setFormColor(tag.color ?? '#2563eb')
    setFormActive(tag.active)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)
    try {
      if (editing) {
        await updateTag(editing.id, {
          name: formName.trim(),
          color: formColor || null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Tag atualizada com sucesso.' })
      } else {
        await createTag({
          name: formName.trim(),
          color: formColor || null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Tag criada com sucesso.' })
      }
      setModalOpen(false)
      await loadTags()
    } catch {
      showFeedback({
        type: 'error',
        message: editing ? 'Erro ao atualizar tag.' : 'Erro ao criar tag.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await deleteTag(deleteId)
      setDeleteId(null)
      showFeedback({ type: 'success', message: 'Tag inativada com sucesso.' })
      await loadTags()
    } catch {
      showFeedback({ type: 'error', message: 'Erro ao inativar tag.' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Gestão de tags para classificação de documentos via n8n"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} />
              Nova tag
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
          <p className="p-8 text-center text-sm text-slate-500">Carregando tags...</p>
        ) : tags.length === 0 ? (
          <EmptyState icon={TagsIcon} title="Nenhuma tag encontrada" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cor</th>
                <th className="px-4 py-3 font-medium">Visual</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{tag.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full border border-slate-200"
                        style={{ backgroundColor: tag.color ?? '#64748b' }}
                        aria-hidden
                      />
                      <span className="font-mono text-xs">{tag.color ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TagBadge tag={tag} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={tag.active ? 'success' : 'danger'}>
                      {tag.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(tag.id)}>
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
        title={editing ? 'Editar tag' : 'Nova tag'}
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
          <div>
            <label className="text-sm font-medium text-slate-700">Cor</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-slate-300"
              />
              <TagBadge tag={{ id: 'preview', name: formName || 'Prévia', color: formColor, active: true, createdAt: '', updatedAt: '' }} />
            </div>
          </div>
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
        title="Inativar tag"
        message="Deseja inativar esta tag? Ela permanecerá no sistema com status inativo."
        confirmLabel={deleting ? 'Inativando...' : 'Inativar'}
        danger
      />
    </div>
  )
}
