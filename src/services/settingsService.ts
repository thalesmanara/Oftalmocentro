import { API_BASE_URL } from './api'
import { mockSystemSettings } from '@/data/mocks'
import type { SystemSettings } from '@/types'

function parseSettings(data: unknown): SystemSettings | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseSettings(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.systemName) {
    return record as unknown as SystemSettings
  }

  if (record.data) {
    return parseSettings(record.data)
  }

  return null
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getSettings(): Promise<SystemSettings> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/settings`)

    if (!response.ok) {
      throw new Error('Erro ao buscar configurações')
    }

    const data = await response.json()

    if (Array.isArray(data) && data.length > 0) {
      return data[0]
    }

    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data[0]
    }

    if (data?.data && !Array.isArray(data.data)) {
      return data.data
    }

    if (data?.id) {
      return data
    }

    return mockSystemSettings
  } catch (error) {
    console.warn('Usando configurações mockadas por falha no webhook:', error)
    return mockSystemSettings
  }
}

export async function updateSettings(data: SystemSettings): Promise<SystemSettings> {
  const response = await fetch(`${API_BASE_URL}/webhook/settings/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: data.id,
      systemName: data.systemName,
      clinicName: data.clinicName,
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar configurações')
  }

  const updated = parseSettings(result)
  if (!updated) {
    throw new Error('Resposta inválida ao atualizar configurações')
  }

  return updated
}
