import { API_BASE_URL, mockDelay } from './api'
import { mockUsers, mockUserPasswords } from '@/data/mocks'
import type { User, UserFormData } from '@/types'

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
  const user = users.find((u) => u.id === id) ?? mockUsers.find((u) => u.id === id)
  return mockDelay(user ?? null)
}

// Futuro: POST `${API_BASE_URL}/webhook/users/create`
export async function createUser(data: UserFormData): Promise<User> {
  const id = `user-${Date.now()}`
  const now = new Date().toISOString()
  const user: User = {
    id,
    name: data.name,
    email: data.email,
    sectorId: data.sectorId,
    active: data.active,
    isMaster: data.isMaster,
    permissions: data.permissions,
    createdAt: now,
    updatedAt: now,
  }
  if (data.password) {
    mockUserPasswords[id] = data.password
  }
  mockUsers.push(user)
  return mockDelay(user)
}

// Futuro: PUT `${API_BASE_URL}/webhook/users/update`
export async function updateUser(id: string, data: Partial<UserFormData>): Promise<User | null> {
  const index = mockUsers.findIndex((u) => u.id === id)
  if (index === -1) return mockDelay(null)

  const existing = mockUsers[index]
  if (data.password && data.password.length > 0) {
    mockUserPasswords[id] = data.password
  }
  const updated: User = {
    ...existing,
    name: data.name ?? existing.name,
    email: data.email ?? existing.email,
    sectorId: data.sectorId !== undefined ? data.sectorId : existing.sectorId,
    active: data.active ?? existing.active,
    isMaster: data.isMaster ?? existing.isMaster,
    permissions: data.permissions ?? existing.permissions,
    updatedAt: new Date().toISOString(),
  }
  mockUsers[index] = updated
  return mockDelay(updated)
}

// Futuro: DELETE `${API_BASE_URL}/webhook/users/delete`
export async function deleteUser(id: string): Promise<boolean> {
  const index = mockUsers.findIndex((u) => u.id === id)
  if (index === -1) return mockDelay(false)
  mockUsers.splice(index, 1)
  delete mockUserPasswords[id]
  return mockDelay(true)
}
