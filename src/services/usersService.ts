import { API_BASE_URL } from './api'
import { mockUsers } from '@/data/mocks'
import type { User, UserFormData } from '@/types'

function parseUser(data: unknown): User | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseUser(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.email) {
    return record as unknown as User
  }

  if (record.user) {
    return parseUser(record.user)
  }

  if (record.data) {
    return parseUser(record.data)
  }

  return null
}

async function resolveUserAfterCreate(result: unknown, email: string): Promise<User> {
  const parsed = parseUser(result)
  if (parsed) return parsed

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const users = await getUsers()
    const found = users.find(
      (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase()
    )
    if (found) return found

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }

  throw new Error('Resposta inválida ao criar usuário')
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/users`)

    if (!response.ok) {
      throw new Error('Erro ao buscar usuários')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data
    }

    return mockUsers
  } catch (error) {
    console.warn('Usando usuários mockados por falha no webhook:', error)
    return mockUsers
  }
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

  const response = await fetch(`${API_BASE_URL}/webhook/users/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao criar usuário')
  }

  return resolveUserAfterCreate(result, data.email)
}

export async function updateUser(
  id: string,
  data: Pick<UserFormData, 'name' | 'email' | 'sectorId' | 'active' | 'isMaster' | 'permissions'>
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/webhook/users/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: data.name,
      email: data.email,
      sectorId: data.sectorId,
      active: data.active,
      isMaster: data.isMaster,
      permissions: data.permissions,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar usuário')
  }

  const user = parseUser(result)
  if (!user) {
    throw new Error('Resposta inválida ao atualizar usuário')
  }

  return user
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhook/users/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao inativar usuário')
  }
}
