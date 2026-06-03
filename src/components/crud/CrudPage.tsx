import { useEffect, useState, type ReactNode } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileText } from 'lucide-react'

export interface CrudColumn<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
}

interface CrudPageProps<T extends { id: string }> {
  title: string
  description: string
  columns: CrudColumn<T>[]
  loadItems: () => Promise<T[]>
  onCreate: (data: Partial<T>) => Promise<void>
  onUpdate: (id: string, data: Partial<T>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  renderForm: (
    item: T | null,
    onChange: (data: Partial<T>) => void,
    data: Partial<T>
  ) => ReactNode
  getEmptyLabel?: string
}

export function CrudPage<T extends { id: string }>({
  title,
  description,
  columns,
  loadItems,
  onCreate,
  onUpdate,
  onDelete,
  renderForm,
  getEmptyLabel = 'Nenhum registro',
}: CrudPageProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [formData, setFormData] = useState<Partial<T>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const refresh = () => void loadItems().then(setItems)

  useEffect(() => {
    refresh()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormData({})
    setModalOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    setFormData({ ...item })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (editing) {
      await onUpdate(editing.id, formData)
    } else {
      await onCreate(formData)
    }
    setModalOpen(false)
    refresh()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await onDelete(deleteId)
    setDeleteId(null)
    refresh()
  }

  const getCellValue = (item: T, col: CrudColumn<T>) => {
    if (col.render) return col.render(item)
    const val = item[col.key as keyof T]
    return String(val ?? '—')
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Novo
          </Button>
        }
      />

      <Card className="overflow-x-auto !p-0">
        {items.length === 0 ? (
          <EmptyState icon={FileText} title={getEmptyLabel} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                {columns.map((col) => (
                  <th key={String(col.key)} className="px-4 py-3 font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      {getCellValue(item, col)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}>
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
        title={editing ? 'Editar' : 'Novo registro'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </>
        }
      >
        {renderForm(editing, setFormData, formData)}
      </Modal>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Confirmar exclusão"
        message="Deseja excluir este registro?"
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
