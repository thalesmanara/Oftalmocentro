import { API_BASE_URL, mockDelay } from './api'
import { ALL_PERMISSION_CODES } from '@/data/mocks'
import type { AuthUser } from '@/types'

const USER_STORAGE_KEY = 'user'
const TOKEN_STORAGE_KEY = 'token'

const MOCK_CREDENTIALS = {
  email: 'admin@oftalmocentro.cloud',
  password: 'admin123',
}

export const MOCK_AUTH_USER: AuthUser = {
  id: 'master',
  name: 'Administrador',
  email: 'admin@oftalmocentro.cloud',
  sectorName: 'ADMINISTRAÇÃO',
  isMaster: true,
  permissions: [...ALL_PERMISSION_CODES],
}

export interface LoginResult {
  user: AuthUser
  token: string
}

/**
 * Autentica o usuário.
 *
 * Futuro (n8n):
 * POST `${API_BASE_URL}/webhook/auth/login`
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  await mockDelay(null)

  const normalizedEmail = email.trim().toLowerCase()
  if (
    normalizedEmail !== MOCK_CREDENTIALS.email ||
    password !== MOCK_CREDENTIALS.password
  ) {
    return null
  }

  const token = `mock-token-${Date.now()}`
  return { user: { ...MOCK_AUTH_USER }, token }
}

export function logout(): void {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function persistSession(user: AuthUser, token: string): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export const AUTH_LOGIN_URL = `${API_BASE_URL}/webhook/auth/login`
