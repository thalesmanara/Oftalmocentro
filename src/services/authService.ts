import { API_BASE_URL, mockDelay } from './api'
import type { AuthUser } from '@/types'
import { ALL_PERMISSIONS } from '@/types'

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
  permissions: [...ALL_PERMISSIONS],
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
 * Body: { email, password }
 * Response: { user, token }
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  // Integração futura com n8n:
  // const response = await apiFetch<LoginResult>('/webhook/auth/login', {
  //   method: 'POST',
  //   body: JSON.stringify({ email, password }),
  // })
  // persistSession(response.user, response.token)
  // return response

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

/**
 * Encerra a sessão removendo dados do localStorage.
 *
 * Futuro (n8n):
 * POST `${API_BASE_URL}/webhook/auth/logout` (opcional, com token no header)
 */
export function logout(): void {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

/** Retorna o usuário persistido no localStorage, se existir. */
export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

/** Retorna o token persistido no localStorage, se existir. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function persistSession(user: AuthUser, token: string): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/** URL base documentada para integração futura */
export const AUTH_LOGIN_URL = `${API_BASE_URL}/webhook/auth/login`
