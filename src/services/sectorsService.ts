import { API_BASE_URL, apiFetch } from './api'
import { mockSectors } from '@/data/mocks'
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

  if (record.data) {
    return parseSector(record.data)
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

export async function getSectors(): Promise<Sector[]> {
  try {
    const response = await apiFetch(`/webhook/sectors`)

    if (!response.ok) {
      throw new Error('Erro ao buscar setores')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data as Sector[]
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data as Sector[]
    }

    return mockSectors
  } catch (error) {
    console.warn('Usando setores mockados por falha no webhook:', error)
    return mockSectors
  }
}

export async function createSector(
  data: Omit<Sector, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Sector> {
  const response = await apiFetch(`/webhook/sectors/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao criar setor')
  }

  const sector = parseSector(result)
  if (!sector) {
    throw new Error('Resposta inválida ao criar setor')
  }

  return sector
}

export async function updateSector(
  id: string,
  data: Pick<Sector, 'name' | 'description' | 'active'>
): Promise<Sector> {
  const response = await apiFetch(`/webhook/sectors/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: data.name,
      description: data.description,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar setor')
  }

  const sector = parseSector(result)
  if (!sector) {
    throw new Error('Resposta inválida ao atualizar setor')
  }

  return sector
}

export async function deleteSector(id: string): Promise<void> {
  const response = await apiFetch(`/webhook/sectors/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao inativar setor')
  }
}
