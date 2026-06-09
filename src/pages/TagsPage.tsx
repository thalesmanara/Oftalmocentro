import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tags as TagsIcon } from 'lucide-react'
import { getTags, createTag, updateTag, deleteTag } from '@/services/tagsService'
import type { Tag } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagBadge } from '@/components/ui/TagBadge'

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#2563eb')
  const [formActive, setFormActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTags()
      setTags(data)
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
    if (editing) {
      await updateTag(editing.id, {
        name: formName,
        color: formColor || null,
        active: formActive,
      })
    } else {
      await createTag({
        name: formName,
        color: formColor || null,
        active: formActive,
      })
    }
    setModalOpen(false)
    void loadTags()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteTag(deleteId)
    setDeleteId(null)
    void loadTags()
  }

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Tags para classificação de documentos — listagem via n8n com fallback mockado"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Nova tag
          </Button>
        }
      />

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
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{tag.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{tag.color ?? '—'}</td>
                  <td className="px-4 py-3">
                    <TagBadge tag={tag} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={tag.active ? 'success' : 'danger'}>
                      {tag.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar tag' : 'Nova tag'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <Input label="Cor (hex)" type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded"
            />
            Ativo
          </label>
          <p className="text-xs text-slate-400">
            Cadastro/edição mockado localmente. Integração real em breve via n8n.
          </p>
        </div>
      </Modal>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir tag"
        message="Deseja excluir esta tag? (mock local)"
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
