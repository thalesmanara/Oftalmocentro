import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '@/services/usersService'
import { getSectors } from '@/services/sectorsService'
import { getPermissions } from '@/services/permissionsService'
import type { User, UserFormData, Permission, Sector } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getSectorNameById } from '@/utils/entities'
import { getUserRoleBadge } from '@/utils/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ModalConfirm } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { getErrorMessage } from '@/utils/apiError'

type Feedback = { type: 'success' | 'error'; message: string }

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  sectorId: null,
  active: true,
  isMaster: false,
  isTechnicalAdmin: false,
  permissions: [],
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth()
  const canManage = hasPermission('gerenciar_usuarios')
  const canEditPrivileges = currentUser?.isMaster === true

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const showFeedback = (next: Feedback) => {
    setFeedback(next)
    setTimeout(() => setFeedback(null), 4000)
  }

  const loadUsers = useCallback(async (showPageLoading = true) => {
    if (showPageLoading) setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      showFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao carregar usuários.') })
    } finally {
      if (showPageLoading) setLoading(false)
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
      isTechnicalAdmin: u.isTechnicalAdmin,
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

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    if (!editing && !form.password.trim()) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        sectorId: form.sectorId,
        active: form.active,
        isMaster: canEditPrivileges ? form.isMaster : false,
        isTechnicalAdmin: canEditPrivileges ? form.isTechnicalAdmin : false,
        permissions: form.permissions,
      }

      if (editing) {
        await updateUser(editing.id, {
          ...payload,
          isMaster: canEditPrivileges ? form.isMaster : editing.isMaster,
          isTechnicalAdmin: canEditPrivileges
            ? form.isTechnicalAdmin
            : editing.isTechnicalAdmin,
        })
        showFeedback({ type: 'success', message: 'Usuário atualizado com sucesso.' })
      } else {
        await createUser(payload)
        showFeedback({ type: 'success', message: 'Usuário criado com sucesso.' })
      }

      setModalOpen(false)
      resetForm()
      await loadUsers(false)
    } catch (err) {
      showFeedback({
        type: 'error',
        message: getErrorMessage(
          err,
          editing ? 'Erro ao atualizar usuário.' : 'Erro ao criar usuário.'
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId || !currentUser) return

    setDeleting(true)
    try {
      await deleteUser(deleteId)
      setDeleteId(null)
      showFeedback({ type: 'success', message: 'Usuário inativado com sucesso.' })
      await loadUsers(false)
    } catch (err) {
      showFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao inativar usuário.') })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando...</p>
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gestão de usuários e permissões individuais via n8n"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Novo usuário
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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Setor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Permissões</th>
              {canManage && <th className="px-4 py-3 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const role = getUserRoleBadge(u)
              return (
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
                    <Badge variant={role.variant}>{role.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.permissions.length} permissões
                  </td>
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
              )
            })}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.name.trim() ||
                !form.email.trim() ||
                (!editing && !form.password.trim())
              }
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={editing ? 'Nova senha (opcional)' : 'Senha provisória'}
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
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded"
            />
            Usuário ativo
          </label>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isMaster}
                disabled={!canEditPrivileges}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isMaster: e.target.checked,
                    // Master já cobre o técnico; mantém flag independente se desmarcar master
                  })
                }
                className="mt-0.5 rounded"
              />
              <span>
                <span className="font-medium">Usuário master</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Acesso total ao sistema (bypass de permissões).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isTechnicalAdmin}
                disabled={!canEditPrivileges}
                onChange={(e) => setForm({ ...form, isTechnicalAdmin: e.target.checked })}
                className="mt-0.5 rounded"
              />
              <span>
                <span className="font-medium">Administrador técnico</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Permite acesso às configurações avançadas, monitoramento e governança técnica do
                  sistema. Não equivale a Master e não ignora permissões operacionais.
                </span>
              </span>
            </label>
            {!canEditPrivileges && (
              <p className="text-xs text-amber-700">
                Somente um usuário master pode alterar Master ou Administrador técnico.
              </p>
            )}
          </div>

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
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Inativar usuário"
        message="Deseja inativar este usuário? Ele permanecerá no sistema com status inativo."
        confirmLabel={deleting ? 'Inativando...' : 'Inativar'}
        danger
      />
    </div>
  )
}
