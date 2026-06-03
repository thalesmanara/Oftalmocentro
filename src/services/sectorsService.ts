import { mockDelay } from './api'
import { mockSectors } from '@/data/mocks'
import type { Sector } from '@/types'

export async function getSectors(): Promise<Sector[]> {
  return mockDelay([...mockSectors])
}

export async function createSector(data: Omit<Sector, 'id'>): Promise<Sector> {
  const sector: Sector = { ...data, id: `sector-${Date.now()}` }
  mockSectors.push(sector)
  return mockDelay(sector)
}

export async function updateSector(id: string, data: Partial<Sector>): Promise<Sector | null> {
  const index = mockSectors.findIndex((s) => s.id === id)
  if (index === -1) return mockDelay(null)
  mockSectors[index] = { ...mockSectors[index], ...data }
  return mockDelay(mockSectors[index])
}

export async function deleteSector(id: string): Promise<boolean> {
  const index = mockSectors.findIndex((s) => s.id === id)
  if (index === -1) return mockDelay(false)
  mockSectors.splice(index, 1)
  return mockDelay(true)
}
