/**
 * Camada base de API para integração com n8n (webhooks).
 *
 * Arquitetura:
 * React (frontend) → Webhooks/API n8n → PostgreSQL
 *
 * O frontend NUNCA acessa o PostgreSQL diretamente.
 */

export const API_BASE_URL =
  import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.oftalmocentrouberaba.cloud'

const TOKEN_STORAGE_KEY = 'oftalmocentro_token'
const EXPIRES_STORAGE_KEY = 'oftalmocentro_expires_at'

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function getTokenExpiresAt(): string | null {
  try {
    return localStorage.getItem(EXPIRES_STORAGE_KEY)
  } catch {
    return null
  }
}

export function persistAuthToken(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  localStorage.setItem(EXPIRES_STORAGE_KEY, expiresAt)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(EXPIRES_STORAGE_KEY)
  localStorage.removeItem('token')
}

export function isTokenExpired(expiresAt?: string | null): boolean {
  const value = expiresAt ?? getTokenExpiresAt()
  if (!value) return false
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return false
  return Date.now() >= ts
}

function buildHeaders(init?: HeadersInit, withJson = true): Headers {
  const headers = new Headers(init)

  if (withJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

async function handleUnauthorized(response: Response): Promise<void> {
  if (response.status !== 401) return
  clearAuthToken()
  unauthorizedHandler?.()
}

async function readApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.clone().json()) as {
      message?: string
      error?: { message?: string; code?: string }
    }
    return data.error?.message || data.message || null
  } catch {
    return null
  }
}

/** Fetch autenticado com Bearer automático e tratamento de 401. */
export async function apiFetch(inputPath: string, options?: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const headers = buildHeaders(options?.headers, !isFormData)

  if (isTokenExpired()) {
    clearAuthToken()
    unauthorizedHandler?.()
    throw new Error('Sessão expirada.')
  }

  const response = await fetch(`${API_BASE_URL}${inputPath}`, {
    ...options,
    headers,
  })

  await handleUnauthorized(response)
  return response
}

export async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(endpoint, options)

  if (!response.ok) {
    const apiMessage = await readApiErrorMessage(response)
    if (response.status === 403) {
      throw new Error(
        apiMessage || 'Você não possui permissão para executar esta ação.'
      )
    }
    throw new Error(apiMessage || `Erro na API: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

/** @deprecated Use request() — mantido para compatibilidade */
export async function mockDelay<T>(data: T, ms = 300): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return data
}

export function buildDocumentFormData(
  metadata: Record<string, unknown>,
  file?: File | null
): FormData {
  const formData = new FormData()
  formData.append('metadata', JSON.stringify(metadata))
  if (file) {
    formData.append('file', file)
  }
  return formData
}
