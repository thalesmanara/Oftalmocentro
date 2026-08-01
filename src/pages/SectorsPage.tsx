import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import {
  getSectors,
  createSector,
  updateSector,
  deleteSector,
} from '@/services/sectorsService'
import type { Sector } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { getErrorMessage } from '@/utils/apiError'

type Feedback = { type: 'success' | 'error'; message: string }

export function SectorsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('gerenciar_setores')

  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [formName, setFormName] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const showFeedback = (next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), 4000)
  }

  const loadSectors = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSectors()
      setSectors(data)
    } catch (err) {
      showFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao carregar setores.') })
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
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (sector: Sector) => {
    setEditing(sector)
    setFormName(sector.name)
    setFormActive(sector.active)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    setSaving(true)
    try {
      if (editing) {
        await updateSector(editing.id, {
          name: formName.trim(),
          description: null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Setor atualizado com sucesso.' })
      } else {
        await createSector({
          name: formName.trim(),
          description: null,
          active: formActive,
        })
        showFeedback({ type: 'success', message: 'Setor criado com sucesso.' })
      }
      setModalOpen(false)
      await loadSectors()
    } catch (err) {
      showFeedback({
        type: 'error',
        message: getErrorMessage(
          err,
          editing ? 'Erro ao atualizar setor.' : 'Erro ao criar setor.'
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await deleteSector(deleteId)
      setDeleteId(null)
      showFeedback({ type: 'success', message: 'Setor inativado com sucesso.' })
      await loadSectors()
    } catch (err) {
      showFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao inativar setor.') })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Setores"
        description="Gestão de setores da clínica via n8n"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} />
              Novo setor
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
          <p className="p-8 text-center text-sm text-slate-500">Carregando setores...</p>
        ) : sectors.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum setor encontrado" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectors.map((sector) => (
                <tr key={sector.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{sector.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={sector.active ? 'success' : 'danger'}>
                      {sector.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  {canManage && (
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
        title={editing ? 'Editar setor' : 'Novo setor'}
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
        title="Inativar setor"
        message="Deseja inativar este setor? Ele permanecerá no sistema com status inativo."
        confirmLabel={deleting ? 'Inativando...' : 'Inativar'}
        danger
      />
    </div>
  )
}
