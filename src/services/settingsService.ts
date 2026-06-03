import { mockDelay } from './api'
import { mockSettings } from '@/data/mocks'
import type { SystemSettings } from '@/types'

// Futuro: GET/PUT ${API_BASE_URL}/settings

export async function getSettings(): Promise<SystemSettings> {
  return mockDelay({ ...mockSettings })
}

export async function updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
  Object.assign(mockSettings, data)
  return mockDelay({ ...mockSettings })
}
