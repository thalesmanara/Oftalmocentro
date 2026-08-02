import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api'
import { expectArray } from '@/utils/expectArray'
import type { Sector } from '@/types'

function parseSector(data: unknown): Sector | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseSector(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.name) {
    return record as unknown as Sector
  }

  return null
}

export async function getSectors(): Promise<Sector[]> {
  const data = await apiGet<unknown>('/webhook/sectors')
  return expectArray(data, 'setores').filter((item): item is Sector => Boolean(parseSector(item)))
}

export async function createSector(
  data: Omit<Sector, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Sector> {
  const result = await apiPost<unknown>('/webhook/sectors/create', {
    name: data.name,
    description: data.description,
    active: data.active,
  })

  const sector = parseSector(result)
  if (!sector) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao criar setor',
    })
  }

  return sector
}

export async function updateSector(
  id: string,
  data: Pick<Sector, 'name' | 'description' | 'active'>
): Promise<Sector> {
  const result = await apiPut<unknown>('/webhook/sectors/update', {
    id,
    name: data.name,
    description: data.description,
    active: data.active,
  })

  const sector = parseSector(result)
  if (!sector) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao atualizar setor',
    })
  }

  return sector
}

export async function deleteSector(id: string): Promise<void> {
  await apiDelete('/webhook/sectors/delete', { id })
}
