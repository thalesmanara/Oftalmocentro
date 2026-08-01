import { ApiError, apiGet, apiPut } from './api'
import type { SystemSettings } from '@/types'

function parseSettings(data: unknown): SystemSettings | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseSettings(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && (record.systemName || record.clinicName)) {
    return record as unknown as SystemSettings
  }

  return null
}

export async function getSettings(): Promise<SystemSettings> {
  const data = await apiGet<unknown>('/webhook/settings', { public: true })
  const settings = parseSettings(data)
  if (!settings) {
    throw new ApiError({
      status: 404,
      code: 'SETTINGS_NOT_FOUND',
      message: 'Configurações não encontradas.',
    })
  }
  return settings
}

export async function updateSettings(data: SystemSettings): Promise<SystemSettings> {
  const result = await apiPut<unknown>('/webhook/settings/update', {
    id: data.id,
    systemName: data.systemName,
    clinicName: data.clinicName,
    logoUrl: data.logoUrl,
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
  })

  const updated = parseSettings(result)
  if (!updated) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao atualizar configurações',
    })
  }

  return updated
}
