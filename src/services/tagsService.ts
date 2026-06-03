import { mockDelay } from './api'
import { mockTags } from '@/data/mocks'
import type { Tag } from '@/types'

export async function getTags(): Promise<Tag[]> {
  return mockDelay([...mockTags])
}

export async function createTag(data: Omit<Tag, 'id'>): Promise<Tag> {
  const tag: Tag = { ...data, id: `tag-${Date.now()}` }
  mockTags.push(tag)
  return mockDelay(tag)
}

export async function updateTag(id: string, data: Partial<Tag>): Promise<Tag | null> {
  const index = mockTags.findIndex((t) => t.id === id)
  if (index === -1) return mockDelay(null)
  mockTags[index] = { ...mockTags[index], ...data }
  return mockDelay(mockTags[index])
}

export async function deleteTag(id: string): Promise<boolean> {
  const index = mockTags.findIndex((t) => t.id === id)
  if (index === -1) return mockDelay(false)
  mockTags.splice(index, 1)
  return mockDelay(true)
}
