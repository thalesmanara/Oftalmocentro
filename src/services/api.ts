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

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

/** @deprecated Use request() — mantido para compatibilidade */
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return request<T>(endpoint, options)
}

/** Simula latência de rede nos mocks */
export async function mockDelay<T>(data: T, ms = 300): Promise<T> {
  await delay(ms)
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
