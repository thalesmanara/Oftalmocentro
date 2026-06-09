import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '@/services/usersService'
import { getSectors } from '@/services/sectorsService'
import { logAction } from '@/services/auditService'
import type { User, UserFormData, Permission, Sector } from '@/types'
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getSectorNameById } from '@/utils/entities'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  sectorId: null,
  active: true,
  permissions: [],
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const refresh = () => void getUsers().then(setUsers)

  useEffect(() => {
    refresh()
    void getSectors().then(setSectors)
  }, [])

  const sectorLabel = (user: User) =>
    user.sectorName ?? getSectorNameById(user.sectorId, sectors)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      sectorId: u.sectorId,
      active: u.active,
      permissions: [...u.permissions],
    })
    setModalOpen(true)
  }

  const togglePermission = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }))
  }

  const handleSave = async () => {
    if (editing) {
      await updateUser(editing.id, form)
      if (currentUser) {
        logAction(currentUser.name, 'Alteração de usuário', 'Usuário', `Usuário "${form.name}" atualizado`)
        if (form.permissions.length !== editing.permissions.length) {
          logAction(currentUser.name, 'Alteração de permissões', 'Usuário', `Permissões de ${form.name} alteradas`)
        }
      }
    } else {
      await createUser(form)
      if (currentUser) {
        logAction(currentUser.name, 'Cadastro', 'Usuário', `Usuário "${form.name}" cadastrado`)
      }
    }
    setModalOpen(false)
    refresh()
  }

  const handleDelete = async () => {
    if (!deleteId || !currentUser) return
    const u = users.find((x) => x.id === deleteId)
    await deleteUser(deleteId)
    if (u) logAction(currentUser.name, 'Exclusão', 'Usuário', `Usuário "${u.name}" excluído`)
    setDeleteId(null)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gestão de usuários e permissões individuais"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo usuário
          </Button>
        }
      />

      <Card className="overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Setor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Permissões</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{sectorLabel(u)}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.active ? 'success' : 'danger'}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.permissions.length} permissões</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(u.id)}>
                      <Trash2 size={14} className="text-red-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input
            label={editing ? 'Senha (deixe em branco para manter)' : 'Senha'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
          <Select
            label="Setor"
            value={form.sectorId ?? ''}
            onChange={(e) => setForm({ ...form, sectorId: e.target.value || null })}
            options={[
              { value: '', label: 'Selecione...' },
              ...sectors.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
            Usuário ativo
          </label>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Permissões individuais</p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePermission(p)} className="rounded" />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir usuário"
        message="Deseja excluir este usuário?"
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
