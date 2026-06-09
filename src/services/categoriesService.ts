import { API_BASE_URL, mockDelay } from './api'
import { mockCategories } from '@/data/mocks'
import type { Category } from '@/types'

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/categories`)

    if (!response.ok) {
      throw new Error('Erro ao buscar categorias')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data as Category[]
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data as Category[]
    }

    return mockCategories
  } catch (error) {
    console.warn('Usando categorias mockadas por falha no webhook:', error)
    return mockCategories
  }
}

// Futuro: POST `${API_BASE_URL}/webhook/categories/create`
export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const now = new Date().toISOString()
  const category: Category = { ...data, id: `cat-${Date.now()}`, createdAt: now, updatedAt: now }
  mockCategories.push(category)
  return mockDelay(category)
}

// Futuro: PUT `${API_BASE_URL}/webhook/categories/update`
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

// Futuro: DELETE `${API_BASE_URL}/webhook/categories/delete`
export async function deleteCategory(id: string): Promise<boolean> {
  const index = mockCategories.findIndex((c) => c.id === id)
  if (index === -1) return mockDelay(false)
  mockCategories.splice(index, 1)
  return mockDelay(true)
}
