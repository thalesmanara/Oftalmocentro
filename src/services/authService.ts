import {
  API_BASE_URL,
  ApiError,
  apiFetch,
  clearAuthToken,
  getAccessToken,
  getTokenExpiresAt,
  isTokenExpired,
  persistAuthToken,
  publicRequest,
  request,
} from './api'
import type { AuthUser, PermissionCode } from '@/types'

const USER_STORAGE_KEY = 'oftalmocentro_user'

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

export interface LoginResult {
  user: AuthUser
  token: string
  expiresAt: string
}

interface LoginData {
  token?: string
  expiresAt?: string
  user?: unknown
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const trimmedEmail = email.trim()

  if (!trimmedEmail || !password) {
    throw new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Informe e-mail e senha.',
    })
  }

  try {
    const data = await publicRequest<LoginData>('/webhook/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: trimmedEmail, password }),
    })

    const user = parseAuthUser(data?.user)
    const token = data?.token != null ? String(data.token) : ''
    const expiresAt = data?.expiresAt != null ? String(data.expiresAt) : ''

    if (user && token && expiresAt) {
      return { user, token, expiresAt }
    }

    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao fazer login.',
    })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
        throw new ApiError({
          status: 401,
          code: 'INVALID_CREDENTIALS',
          message: error.message || 'E-mail ou senha inválidos.',
          requestId: error.requestId,
        })
      }
      throw error
    }
    throw new ApiError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Não foi possível realizar o login. Tente novamente.',
    })
  }
}

export async function logout(): Promise<void> {
  const token = getAccessToken()

  if (token) {
    try {
      await apiFetch('/webhook/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    } catch {
      // Logout local mesmo se o webhook falhar
    }
  }

  clearAuthToken()
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem('user')
}

export async function validateSession(): Promise<AuthUser | null> {
  const token = getAccessToken()
  if (!token || isTokenExpired()) {
    clearAuthToken()
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }

  try {
    const data = await request<{ user?: unknown; permissions?: unknown }>('/webhook/auth/validate', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const userPayload =
      data && typeof data === 'object' && 'user' in data
        ? {
            ...(data.user as object),
            permissions:
              (data.user as { permissions?: unknown })?.permissions ?? data.permissions,
          }
        : data

    const user = parseAuthUser(userPayload)
    if (user) {
      persistSession(user)
    }
    return user
  } catch {
    clearAuthToken()
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function getCurrentUser(): AuthUser | null {
  try {
    if (isTokenExpired()) {
      clearAuthToken()
      localStorage.removeItem(USER_STORAGE_KEY)
      return null
    }

    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw) {
      return parseAuthUser(JSON.parse(raw) as unknown)
    }

    const legacy = localStorage.getItem('user')
    if (legacy) {
      const user = parseAuthUser(JSON.parse(legacy) as unknown)
      if (user) {
        persistSession(user)
        localStorage.removeItem('user')
      }
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

export function persistLoginSession(result: LoginResult): void {
  persistAuthToken(result.token, result.expiresAt)
  persistSession(result.user)
}

export function hasStoredAuth(): boolean {
  return Boolean(getAccessToken() && getCurrentUser() && !isTokenExpired(getTokenExpiresAt()))
}

export const AUTH_LOGIN_URL = `${API_BASE_URL}/webhook/auth/login`
