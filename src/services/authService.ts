import { API_BASE_URL } from './api'
import type { AuthUser, PermissionCode } from '@/types'

const USER_STORAGE_KEY = 'oftalmocentro_user'

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizePermissions(permissions: unknown): string[] {
  const ignore = new Set(['gerenciar_tags'])

  if (Array.isArray(permissions)) {
    return permissions.filter(
      (item): item is string => typeof item === 'string' && !ignore.has(item)
    )
  }

  if (permissions && typeof permissions === 'object') {
    return Object.entries(permissions as Record<string, boolean>)
      .filter(([code, value]) => value === true && !ignore.has(code))
      .map(([code]) => code)
  }

  return []
}

function parseAuthUser(data: unknown): AuthUser | null {
  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  const id = record.id != null ? String(record.id) : ''
  const email = record.email != null ? String(record.email) : ''

  if (!id || !email) return null

  if (record.active === false) {
    return null
  }

  return {
    id,
    name: String(record.name ?? ''),
    email,
    sectorName: String(record.sectorName ?? record.sector_name ?? ''),
    isMaster: record.isMaster === true || record.is_master === true,
    permissions: normalizePermissions(record.permissions) as PermissionCode[],
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const trimmedEmail = email.trim()

  if (!trimmedEmail || !password) {
    throw new Error('Informe e-mail e senha.')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/webhook/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    })
  } catch {
    throw new Error('Não foi possível realizar o login. Tente novamente.')
  }

  const result = await parseJsonResponse(response)

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>

    if (record.success === false) {
      throw new Error(String(record.message ?? 'Usuário ou senha inválidos.'))
    }

    const user = parseAuthUser(record.user)
    if (user) return user
  }

  if (!response.ok) {
    throw new Error('Usuário ou senha inválidos.')
  }

  throw new Error('Resposta inválida ao fazer login.')
}

export function logout(): void {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem('user')
  localStorage.removeItem('token')
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as AuthUser
    }

    const legacy = localStorage.getItem('user')
    if (legacy) {
      const user = JSON.parse(legacy) as AuthUser
      persistSession(user)
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      return user
    }

    return null
  } catch {
    return null
  }
}

export function persistSession(user: AuthUser): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export const AUTH_LOGIN_URL = `${API_BASE_URL}/webhook/auth/login`
