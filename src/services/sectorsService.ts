import { ApiError, request } from './api'
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
  const data = await request<unknown>('/webhook/sectors')
  if (!Array.isArray(data)) return []
  return data.filter((item): item is Sector => Boolean(parseSector(item)))
}

export async function createSector(
  data: Omit<Sector, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Sector> {
  const result = await request<unknown>('/webhook/sectors/create', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      active: data.active,
    }),
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
  const result = await request<unknown>('/webhook/sectors/update', {
    method: 'PUT',
    body: JSON.stringify({
      id,
      name: data.name,
      description: data.description,
      active: data.active,
    }),
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
  await request<unknown>('/webhook/sectors/delete', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
