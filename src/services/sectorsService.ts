import { API_BASE_URL, mockDelay } from './api'
import { mockSectors } from '@/data/mocks'
import type { Sector } from '@/types'

export async function getSectors(): Promise<Sector[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/sectors`)

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

// Futuro: POST `${API_BASE_URL}/webhook/sectors/create`
export async function createSector(
  data: Omit<Sector, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Sector> {
  const now = new Date().toISOString()
  const sector: Sector = { ...data, id: `sector-${Date.now()}`, createdAt: now, updatedAt: now }
  mockSectors.push(sector)
  return mockDelay(sector)
}

// Futuro: PUT `${API_BASE_URL}/webhook/sectors/update`
export async function updateSector(id: string, data: Partial<Sector>): Promise<Sector | null> {
  const index = mockSectors.findIndex((s) => s.id === id)
  if (index === -1) return mockDelay(null)
  mockSectors[index] = {
    ...mockSectors[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }
  return mockDelay(mockSectors[index])
}

// Futuro: DELETE `${API_BASE_URL}/webhook/sectors/delete`
export async function deleteSector(id: string): Promise<boolean> {
  const index = mockSectors.findIndex((s) => s.id === id)
  if (index === -1) return mockDelay(false)
  mockSectors.splice(index, 1)
  return mockDelay(true)
}
