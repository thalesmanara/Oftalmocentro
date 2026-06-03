import { mockDelay } from './api'
import { mockUsers } from '@/data/mocks'
import type { User, UserFormData } from '@/types'

// Futuro: GET/POST/PUT/DELETE ${API_BASE_URL}/users

export async function getUsers(): Promise<User[]> {
  return mockDelay(mockUsers.map(({ senha: _, ...u }) => ({ ...u, senha: undefined })))
}

export async function getUserById(id: string): Promise<User | null> {
  const user = mockUsers.find((u) => u.id === id)
  if (!user) return mockDelay(null)
  return mockDelay({ ...user })
}

export async function createUser(data: UserFormData): Promise<User> {
  const id = `user-${Date.now()}`
  const now = new Date().toISOString()
  const user: User = {
    id,
    nome: data.nome,
    email: data.email,
    senha: data.senha,
    setorId: data.setorId,
    ativo: data.ativo,
    permissoes: data.permissoes,
    createdAt: now,
    updatedAt: now,
  }
  mockUsers.push(user)
  return mockDelay(user)
}

export async function updateUser(id: string, data: Partial<UserFormData>): Promise<User | null> {
  const index = mockUsers.findIndex((u) => u.id === id)
  if (index === -1) return mockDelay(null)

  const existing = mockUsers[index]
  const updated: User = {
    ...existing,
    nome: data.nome ?? existing.nome,
    email: data.email ?? existing.email,
    senha: data.senha && data.senha.length > 0 ? data.senha : existing.senha,
    setorId: data.setorId ?? existing.setorId,
    ativo: data.ativo ?? existing.ativo,
    permissoes: data.permissoes ?? existing.permissoes,
    updatedAt: new Date().toISOString(),
  }
  mockUsers[index] = updated
  return mockDelay(updated)
}

export async function deleteUser(id: string): Promise<boolean> {
  const index = mockUsers.findIndex((u) => u.id === id)
  if (index === -1) return mockDelay(false)
  mockUsers.splice(index, 1)
  return mockDelay(true)
}

export async function authenticate(email: string, senha: string): Promise<User | null> {
  const user = mockUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha && u.ativo
  )
  if (!user) return mockDelay(null)
  const { senha: _, ...safe } = user
  return mockDelay({ ...safe, senha: undefined })
}
