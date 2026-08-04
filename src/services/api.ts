/**
 * Cliente HTTP central — React → n8n → PostgreSQL.
 *
 * Responsabilidades: transporte, Bearer, X-Request-Id, envelopes e erros.
 * Regras de domínio ficam nos services.
 */

import {
  ApiError,
  type ApiDownloadResult,
  type ApiEnvelope,
} from '@/types/api'

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

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null
  /** Não envia Bearer (login, settings públicos). */
  public?: boolean
  /** Não dispara logout/redirect em 401 (ex.: logout, validate interno). */
  skipAuthRedirect?: boolean
  /**
   * Timeout opcional em ms.
   * Não usar valores curtos em upload, processamento ou consulta IA.
   */
  timeoutMs?: number
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Gera um UUID válido (preferência v4). Nunca retorna formato não-UUID. */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback RFC4122-ish quando randomUUID não existe
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function resolveOutgoingRequestId(headers: Headers): string {
  const existing = headers.get('X-Request-Id')?.trim()
  if (existing && UUID_RE.test(existing)) return existing
  const generated = createRequestId()
  headers.set('X-Request-Id', generated)
  return generated
}

function buildHeaders(init: HeadersInit | undefined, options: { json: boolean; public: boolean }): Headers {
  const headers = new Headers(init)

  if (options.json && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  resolveOutgoingRequestId(headers)

  if (!options.public) {
    const token = getAccessToken()
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  } else {
    headers.delete('Authorization')
  }

  return headers
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return Boolean(value && typeof value === 'object' && 'success' in (value as object))
}

/**
 * Alguns workflows admin respondem com o wrapper interno do n8n
 * `{ statusCode, response: { success, data|error, meta }, ... }` em vez do
 * envelope no topo. Normaliza para o formato que o front espera.
 */
function normalizeApiPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  if (isEnvelope(payload)) return payload
  const nested = (payload as { response?: unknown }).response
  if (isEnvelope(nested)) return nested
  return payload
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'INVALID_PAYLOAD'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'VALIDATION_ERROR'
    case 502:
    case 503:
      return 'SERVICE_UNAVAILABLE'
    default:
      return 'INTERNAL_ERROR'
  }
}

function notifyUnauthorized(skipAuthRedirect: boolean): void {
  clearAuthToken()
  if (!skipAuthRedirect) {
    unauthorizedHandler?.()
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Interpreta envelope padrão; exige `success` quando presente. */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const payload = normalizeApiPayload(await parseJsonSafe(response))

  if (!response.ok) {
    // Health/down: envelope de sucesso com HTTP 503 — devolver data sem tratar como erro de API.
    if (isEnvelope(payload) && payload.success === true) {
      return payload.data as T
    }

    if (isEnvelope(payload) && payload.success === false) {
      throw new ApiError({
        status: response.status,
        code: payload.error?.code || statusToCode(response.status),
        message: payload.error?.message || `Erro na API: ${response.status}`,
        fields: payload.error?.fields,
        requestId: payload.meta?.requestId || response.headers.get('X-Request-Id') || undefined,
        durationMs:
          typeof payload.meta?.durationMs === 'number'
            ? payload.meta.durationMs
            : parseDurationHeader(response),
      })
    }

    const legacy = payload as { message?: string; error?: { message?: string; code?: string } } | null
    throw new ApiError({
      status: response.status,
      code: legacy?.error?.code || statusToCode(response.status),
      message:
        legacy?.error?.message ||
        legacy?.message ||
        `Erro na API: ${response.status} ${response.statusText}`,
      requestId: response.headers.get('X-Request-Id') || undefined,
      durationMs: parseDurationHeader(response),
    })
  }

  if (isEnvelope(payload)) {
    if (payload.success === false) {
      throw new ApiError({
        status: response.status || 400,
        code: payload.error?.code || 'INTERNAL_ERROR',
        message: payload.error?.message || 'Erro na API.',
        fields: payload.error?.fields,
        requestId: payload.meta?.requestId || response.headers.get('X-Request-Id') || undefined,
        durationMs:
          typeof payload.meta?.durationMs === 'number'
            ? payload.meta.durationMs
            : parseDurationHeader(response),
      })
    }
    return payload.data as T
  }

  // Resposta 2xx sem envelope padronizado — não tratar como dado válido.
  throw new ApiError({
    status: response.status || 500,
    code: 'INVALID_RESPONSE',
    message: 'Resposta da API em formato inesperado.',
    requestId: response.headers.get('X-Request-Id') || undefined,
    durationMs: parseDurationHeader(response),
  })
}

function parseDurationHeader(response: Response): number | undefined {
  const raw = response.headers.get('X-Response-Time-Ms')
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined | null>): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s))
  if (active.length === 0) return undefined
  if (active.length === 1) return active[0]
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active)
  }
  // Fallback: abort combined controller when any input aborts
  const combined = new AbortController()
  const onAbort = () => {
    if (!combined.signal.aborted) combined.abort()
  }
  for (const s of active) {
    if (s.aborted) {
      combined.abort()
      break
    }
    s.addEventListener('abort', onAbort, { once: true })
  }
  return combined.signal
}

const DEFAULT_TIMEOUT_MS = 30_000

async function rawFetch(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
  const {
    public: isPublic = false,
    skipAuthRedirect = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: initHeaders,
    signal,
    body,
    ...rest
  } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = buildHeaders(initHeaders, { json: !isFormData && body != null, public: isPublic })

  if (!isPublic && isTokenExpired()) {
    notifyUnauthorized(skipAuthRedirect)
    throw new ApiError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sessão expirada.',
    })
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  let timeoutSignal: AbortSignal | undefined
  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController()
    timeoutSignal = controller.signal
    timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      body,
      headers,
      signal: mergeAbortSignals([signal, timeoutSignal]),
    })

    if (response.status === 401 && !isPublic) {
      notifyUnauthorized(skipAuthRedirect)
    }

    return response
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({
        status: 499,
        code: timedOut ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED',
        message: timedOut
          ? 'A solicitação excedeu o tempo limite. Tente novamente.'
          : 'Requisição cancelada.',
      })
    }
    throw new ApiError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Não foi possível conectar ao servidor.',
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/** Request genérico com unwrap de `data`. */
export async function apiRequest<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
  const response = await rawFetch(endpoint, options)
  return parseApiResponse<T>(response)
}

export async function apiGet<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' })
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiClientOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body === undefined ? options?.body : JSON.stringify(body),
  })
}

export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiClientOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body === undefined ? options?.body : JSON.stringify(body),
  })
}

export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiClientOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body === undefined ? options?.body : JSON.stringify(body),
  })
}

export async function apiDelete<T = void>(
  endpoint: string,
  body?: unknown,
  options?: ApiClientOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'DELETE',
    body: body === undefined ? options?.body : JSON.stringify(body),
  })
}

/** Upload multipart — não define Content-Type (boundary do browser). */
export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  options?: ApiClientOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: options?.method ?? 'POST',
    body: formData,
  })
}

function parseFileNameFromDisposition(header: string | null): string | null {
  if (!header) return null

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const match = header.match(/filename="?([^";\n]+)"?/i)
  return match?.[1] ?? null
}

/** Download binário — sucesso = Blob; erro = JSON tipado. */
export async function apiDownload(
  endpoint: string,
  options?: ApiClientOptions
): Promise<ApiDownloadResult> {
  const response = await rawFetch(endpoint, {
    ...options,
    method: options?.method ?? 'GET',
  })

  const requestId = response.headers.get('X-Request-Id')
  const durationMs = parseDurationHeader(response) ?? null

  if (!response.ok) {
    try {
      await parseApiResponse(response)
    } catch (error) {
      if (error instanceof ApiError) {
        if (!error.requestId && requestId) error.requestId = requestId
        if (error.durationMs == null && durationMs != null) error.durationMs = durationMs
        throw error
      }
      throw error
    }
    throw new ApiError({
      status: response.status,
      code: statusToCode(response.status),
      message: 'Não foi possível baixar o arquivo.',
      requestId: requestId ?? undefined,
      durationMs: durationMs ?? undefined,
    })
  }

  const blob = await response.blob()
  return {
    blob,
    fileName: parseFileNameFromDisposition(response.headers.get('Content-Disposition')),
    contentType: response.headers.get('Content-Type'),
    requestId,
    durationMs,
  }
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
export type { ApiMeta, ApiSuccess, ApiFailure, ApiErrorResponse, ApiDownloadResult } from '@/types/api'
