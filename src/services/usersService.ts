import { ApiError, request } from './api'
import type { User, UserFormData } from '@/types'

function normalizePermissionCodes(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return []
  return permissions.filter(
    (item): item is string => typeof item === 'string' && item !== 'gerenciar_tags'
  )
}

function normalizeUser(record: Record<string, unknown>): User {
  return {
    id: String(record.id),
    name: String(record.name ?? ''),
    email: String(record.email ?? ''),
    sectorId:
      record.sectorId === null || record.sectorId === undefined || record.sectorId === ''
        ? null
        : String(record.sectorId),
    sectorName:
      record.sectorName === null || record.sectorName === undefined
        ? null
        : String(record.sectorName),
    active: record.active !== false,
    isMaster: record.isMaster === true || record.is_master === true,
    permissions: normalizePermissionCodes(record.permissions),
    createdAt: String(record.createdAt ?? record.created_at ?? ''),
    updatedAt: String(record.updatedAt ?? record.updated_at ?? ''),
  }
}

function parseUser(data: unknown): User | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseUser(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.email) {
    return normalizeUser(record)
  }

  if (record.user) {
    return parseUser(record.user)
  }

  return null
}

function asUserList(data: unknown): User[] {
  if (!Array.isArray(data)) return []
  return data.map((item) => parseUser(item)).filter((user): user is User => user !== null)
}

export async function getUsers(): Promise<User[]> {
  const data = await request<unknown>('/webhook/users')
  return asUserList(data)
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await getUsers()
  return users.find((u) => u.id === id) ?? null
}

export async function createUser(data: UserFormData): Promise<User> {
  const payload: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    sectorId: data.sectorId,
    active: data.active,
    isMaster: data.isMaster,
    permissions: data.permissions,
  }

  if (data.password.trim()) {
    payload.passwordHash = data.password
  }

  try {
    const result = await request<unknown>('/webhook/users/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const user = parseUser(result)
    if (!user) {
      throw new ApiError({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Resposta inválida ao criar usuário',
      })
    }
    return user
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Erro ao criar usuário',
    })
  }
}

export async function updateUser(
  id: string,
  data: Pick<
    UserFormData,
    'name' | 'email' | 'password' | 'sectorId' | 'active' | 'isMaster' | 'permissions'
  >
): Promise<User> {
  const payload: Record<string, unknown> = {
    id,
    name: data.name,
    email: data.email,
    sectorId: data.sectorId,
    active: data.active,
    isMaster: data.isMaster,
    permissions: data.permissions,
  }

  if (data.password?.trim()) {
    payload.passwordHash = data.password.trim()
  }

  const result = await request<unknown>('/webhook/users/update', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

  const user = parseUser(result)
  if (!user) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao atualizar usuário',
    })
  }

  return user
}

export async function deleteUser(id: string): Promise<void> {
  await request<unknown>('/webhook/users/delete', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
