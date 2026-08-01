/**
 * Camada base de API para integração com n8n (webhooks).
 *
 * Arquitetura:
 * React (frontend) → Webhooks/API n8n → PostgreSQL
 *
 * O frontend NUNCA acessa o PostgreSQL diretamente.
 */

import { ApiError, type ApiEnvelope, type ApiMeta } from '@/types/api'

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

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildHeaders(init?: HeadersInit, withJson = true): Headers {
  const headers = new Headers(init)

  if (withJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', createRequestId())
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

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return Boolean(value && typeof value === 'object' && 'success' in (value as object))
}

/** Compatibilidade temporária: aceita envelope novo e formatos legados. */
export function unwrapApiData<T>(payload: unknown): { data: T; meta?: ApiMeta } {
  if (isEnvelope(payload)) {
    if (payload.success === false) {
      throw new ApiError({
        status: 400,
        code: payload.error?.code || 'INTERNAL_ERROR',
        message: payload.error?.message || 'Erro na API.',
        fields: payload.error?.fields,
        requestId: payload.meta?.requestId,
      })
    }
    return { data: payload.data as T, meta: payload.meta }
  }

  return { data: payload as T }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    if (isEnvelope(payload) && payload.success === false) {
      throw new ApiError({
        status: response.status,
        code: payload.error?.code || 'INTERNAL_ERROR',
        message: payload.error?.message || `Erro na API: ${response.status}`,
        fields: payload.error?.fields,
        requestId: payload.meta?.requestId,
      })
    }

    const legacy = payload as { message?: string; error?: { message?: string; code?: string } } | null
    throw new ApiError({
      status: response.status,
      code: legacy?.error?.code || (response.status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR'),
      message:
        legacy?.error?.message ||
        legacy?.message ||
        `Erro na API: ${response.status} ${response.statusText}`,
    })
  }

  const { data } = unwrapApiData<T>(payload)
  return data
}

/** Fetch autenticado com Bearer automático, X-Request-Id e tratamento de 401. */
export async function apiFetch(inputPath: string, options?: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const headers = buildHeaders(options?.headers, !isFormData)

  if (isTokenExpired()) {
    clearAuthToken()
    unauthorizedHandler?.()
    throw new ApiError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sessão expirada.',
    })
  }

  const response = await fetch(`${API_BASE_URL}${inputPath}`, {
    ...options,
    headers,
  })

  await handleUnauthorized(response)
  return response
}

/** Request JSON com unwrap do envelope padrão (`data`). */
export async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(endpoint, options)
  return parseApiResponse<T>(response)
}

/** Request sem autenticação (login / settings públicos). */
export async function publicRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const headers = buildHeaders(options?.headers, !isFormData)
  headers.delete('Authorization')

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  return parseApiResponse<T>(response)
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

export { ApiError }
export type { ApiMeta, ApiSuccess, ApiErrorResponse } from '@/types/api'
