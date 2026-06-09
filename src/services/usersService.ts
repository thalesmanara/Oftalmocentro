import { mockDelay } from './api'
import { mockUsers, mockUserPasswords } from '@/data/mocks'
import type { User, UserFormData } from '@/types'

export async function getUsers(): Promise<User[]> {
  return mockDelay([...mockUsers])
}

export async function getUserById(id: string): Promise<User | null> {
  const user = mockUsers.find((u) => u.id === id)
  return mockDelay(user ?? null)
}

export async function createUser(data: UserFormData): Promise<User> {
  const id = `user-${Date.now()}`
  const now = new Date().toISOString()
  const user: User = {
    id,
    name: data.name,
    email: data.email,
    sectorId: data.sectorId,
    active: data.active,
    isMaster: false,
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
    permissions: data.permissions ?? existing.permissions,
    updatedAt: new Date().toISOString(),
  }
  mockUsers[index] = updated
  return mockDelay(updated)
}

export async function deleteUser(id: string): Promise<boolean> {
  const index = mockUsers.findIndex((u) => u.id === id)
  if (index === -1) return mockDelay(false)
  mockUsers.splice(index, 1)
  delete mockUserPasswords[id]
  return mockDelay(true)
}
