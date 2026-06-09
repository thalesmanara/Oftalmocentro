import { mockDelay } from './api'
import { mockCategories } from '@/data/mocks'
import type { Category } from '@/types'

export async function getCategories(): Promise<Category[]> {
  return mockDelay([...mockCategories])
}

export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const now = new Date().toISOString()
  const category: Category = { ...data, id: `cat-${Date.now()}`, createdAt: now, updatedAt: now }
  mockCategories.push(category)
  return mockDelay(category)
}

export async function updateCategory(
  id: string,
  data: Partial<Category>
): Promise<Category | null> {
  const index = mockCategories.findIndex((c) => c.id === id)
  if (index === -1) return mockDelay(null)
  mockCategories[index] = {
    ...mockCategories[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }
  return mockDelay(mockCategories[index])
}

export async function deleteCategory(id: string): Promise<boolean> {
  const index = mockCategories.findIndex((c) => c.id === id)
  if (index === -1) return mockDelay(false)
  mockCategories.splice(index, 1)
  return mockDelay(true)
}
