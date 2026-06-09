import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getSectors,
  createSector,
  updateSector,
  deleteSector,
} from '@/services/sectorsService'
import type { Sector } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileText } from 'lucide-react'

export function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadSectors = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSectors()
      setSectors(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSectors()
  }, [loadSectors])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormDescription('')
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (sector: Sector) => {
    setEditing(sector)
    setFormName(sector.name)
    setFormDescription(sector.description ?? '')
    setFormActive(sector.active)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (editing) {
      await updateSector(editing.id, {
        name: formName,
        description: formDescription || null,
        active: formActive,
      })
    } else {
      await createSector({
        name: formName,
        description: formDescription || null,
        active: formActive,
      })
    }
    setModalOpen(false)
    void loadSectors()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteSector(deleteId)
    setDeleteId(null)
    void loadSectors()
  }

  return (
    <div>
      <PageHeader
        title="Setores"
        description="Setores da clínica — listagem via n8n com fallback mockado"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Novo setor
          </Button>
        }
      />

      <Card className="overflow-x-auto !p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando setores...</p>
        ) : sectors.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum setor encontrado" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectors.map((sector) => (
                <tr key={sector.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{sector.name}</td>
                  <td className="px-4 py-3 text-slate-600">{sector.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={sector.active ? 'success' : 'danger'}>
                      {sector.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(sector)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(sector.id)}>
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
        title={editing ? 'Editar setor' : 'Novo setor'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
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
          <p className="text-xs text-slate-400">
            Cadastro/edição mockado localmente. Integração real em breve via n8n.
          </p>
        </div>
      </Modal>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir setor"
        message="Deseja excluir este setor? (mock local)"
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
