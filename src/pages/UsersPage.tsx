import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '@/services/usersService'
import { getSectors } from '@/services/sectorsService'
import { getPermissions } from '@/services/permissionsService'
import { logAction } from '@/services/auditService'
import type { User, UserFormData, Permission, Sector } from '@/types'
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
  isMaster: false,
  permissions: [],
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
    void getSectors().then(setSectors)
    setPermissionsLoading(true)
    void getPermissions()
      .then(setPermissions)
      .finally(() => setPermissionsLoading(false))
  }, [loadUsers])

  const sectorLabel = (user: User) =>
    user.sectorName ?? getSectorNameById(user.sectorId, sectors)

  const canManage = hasPermission('gerenciar_usuarios')

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
      isMaster: u.isMaster,
      permissions: [...u.permissions],
    })
    setModalOpen(true)
  }

  const togglePermission = (code: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter((x) => x !== code)
        : [...f.permissions, code],
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
    void loadUsers()
  }

  const handleDelete = async () => {
    if (!deleteId || !currentUser) return
    const u = users.find((x) => x.id === deleteId)
    await deleteUser(deleteId)
    if (u) logAction(currentUser.name, 'Exclusão', 'Usuário', `Usuário "${u.name}" excluído`)
    setDeleteId(null)
    void loadUsers()
  }

  if (loading) {
    return <p className="text-slate-500">Carregando...</p>
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gestão de usuários e permissões individuais"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Novo usuário
            </Button>
          ) : undefined
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
              <th className="px-4 py-3 font-medium">Master</th>
              <th className="px-4 py-3 font-medium">Permissões</th>
              {canManage && <th className="px-4 py-3 font-medium">Ações</th>}
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
                <td className="px-4 py-3">
                  <Badge variant={u.isMaster ? 'info' : 'default'}>
                    {u.isMaster ? 'Sim' : 'Não'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.permissions.length} permissões</td>
                {canManage && (
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
                )}
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
          {currentUser?.isMaster && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isMaster}
                onChange={(e) => setForm({ ...form, isMaster: e.target.checked })}
                className="rounded"
              />
              Usuário master (acesso total)
            </label>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Permissões individuais</p>
            {permissionsLoading ? (
              <p className="text-sm text-slate-500">Carregando permissões...</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {permissions.map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission.code)}
                      onChange={() => togglePermission(permission.code)}
                      className="rounded"
                    />
                    {permission.name}
                  </label>
                ))}
              </div>
            )}
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
