/**
 * Camada base de API para integração futura com n8n (webhooks).
 *
 * Arquitetura prevista:
 * React (frontend) → Webhooks/API n8n (VPS Hostinger) → PostgreSQL (VPS Hostinger)
 *
 * O frontend NUNCA acessa o PostgreSQL diretamente.
 * Substitua os mocks nos serviços por chamadas HTTP usando apiFetch quando o n8n estiver pronto.
 */

export const API_BASE_URL = import.meta.env.VITE_N8N_BASE_URL ?? ''

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'VITE_N8N_BASE_URL não configurada. Utilize os serviços mock até a integração com n8n.'
    )
  }

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

/** Simula latência de rede nos mocks */
export async function mockDelay<T>(data: T, ms = 300): Promise<T> {
  await delay(ms)
  return data
}

/**
 * Upload futuro via FormData para webhook n8n.
 * Exemplo de uso quando a integração estiver ativa:
 *
 * const formData = new FormData()
 * formData.append('file', file)
 * formData.append('metadata', JSON.stringify(meta))
 * await fetch(`${API_BASE_URL}/documents/upload`, { method: 'POST', body: formData })
 */
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
