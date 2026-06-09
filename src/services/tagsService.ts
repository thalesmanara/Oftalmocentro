import { API_BASE_URL, mockDelay } from './api'
import { mockTags } from '@/data/mocks'
import type { Tag } from '@/types'

export async function getTags(): Promise<Tag[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/tags`)

    if (!response.ok) {
      throw new Error('Erro ao buscar tags')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data as Tag[]
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data as Tag[]
    }

    return mockTags
  } catch (error) {
    console.warn('Usando tags mockadas por falha no webhook:', error)
    return mockTags
  }
}

// Futuro: POST `${API_BASE_URL}/webhook/tags/create`
export async function createTag(data: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tag> {
  const now = new Date().toISOString()
  const tag: Tag = { ...data, id: `tag-${Date.now()}`, createdAt: now, updatedAt: now }
  mockTags.push(tag)
  return mockDelay(tag)
}

// Futuro: PUT `${API_BASE_URL}/webhook/tags/update`
export async function updateTag(id: string, data: Partial<Tag>): Promise<Tag | null> {
  const index = mockTags.findIndex((t) => t.id === id)
  if (index === -1) return mockDelay(null)
  mockTags[index] = { ...mockTags[index], ...data, updatedAt: new Date().toISOString() }
  return mockDelay(mockTags[index])
}

// Futuro: DELETE `${API_BASE_URL}/webhook/tags/delete`
export async function deleteTag(id: string): Promise<boolean> {
  const index = mockTags.findIndex((t) => t.id === id)
  if (index === -1) return mockDelay(false)
  mockTags.splice(index, 1)
  return mockDelay(true)
}
