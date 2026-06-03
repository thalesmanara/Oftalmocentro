import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '@/services/usersService'
import { getSectors } from '@/services/sectorsService'
import { logAction } from '@/services/auditService'
import type { User, UserFormData, Permission, Sector } from '@/types'
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

const emptyForm: UserFormData = {
  nome: '',
  email: '',
  senha: '',
  setorId: '',
  ativo: true,
  permissoes: [],
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const refresh = () => {
    void getUsers().then(setUsers)
  }

  useEffect(() => {
    refresh()
    void getSectors().then(setSectors)
  }, [])

  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.nome ?? '—'

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      setorId: u.setorId,
      ativo: u.ativo,
      permissoes: [...u.permissoes],
    })
    setModalOpen(true)
  }

  const togglePermission = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissoes: f.permissoes.includes(p)
        ? f.permissoes.filter((x) => x !== p)
        : [...f.permissoes, p],
    }))
  }

  const handleSave = async () => {
    if (editing) {
      await updateUser(editing.id, form)
      if (currentUser) {
        logAction(currentUser.nome, 'Alteração de usuário', 'Usuário', `Usuário "${form.nome}" atualizado`)
        if (form.permissoes.length !== editing.permissoes.length) {
          logAction(currentUser.nome, 'Alteração de permissões', 'Usuário', `Permissões de ${form.nome} alteradas`)
        }
      }
    } else {
      await createUser(form)
      if (currentUser) {
        logAction(currentUser.nome, 'Cadastro', 'Usuário', `Usuário "${form.nome}" cadastrado`)
      }
    }
    setModalOpen(false)
    refresh()
  }

  const handleDelete = async () => {
    if (!deleteId || !currentUser) return
    const u = users.find((x) => x.id === deleteId)
    await deleteUser(deleteId)
    if (u) logAction(currentUser.nome, 'Exclusão', 'Usuário', `Usuário "${u.nome}" excluído`)
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
            <Plus size={16} />
            Novo usuário
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
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{sectorName(u.setorId)}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.ativo ? 'success' : 'danger'}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.permissoes.length} permissões</td>
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
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input
            label={editing ? 'Senha (deixe em branco para manter)' : 'Senha'}
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            required={!editing}
          />
          <Select
            label="Setor"
            value={form.setorId}
            onChange={(e) => setForm({ ...form, setorId: e.target.value })}
            options={[
              { value: '', label: 'Selecione...' },
              ...sectors.map((s) => ({ value: s.id, label: s.nome })),
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="rounded"
            />
            Usuário ativo
          </label>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Permissões individuais</p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.permissoes.includes(p)}
                    onChange={() => togglePermission(p)}
                    className="rounded"
                  />
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
