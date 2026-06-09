import { API_BASE_URL, mockDelay } from './api'
import { mockSettings, mockSystemSettings } from '@/data/mocks'
import type { SystemSettings } from '@/types'

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

// Futuro: PUT `${API_BASE_URL}/webhook/settings/update`
export async function updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
  Object.assign(mockSettings, data, { updatedAt: new Date().toISOString() })
  return mockDelay({ ...mockSettings })
}
