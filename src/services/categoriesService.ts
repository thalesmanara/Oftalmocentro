import { API_BASE_URL } from './api'
import { mockCategories } from '@/data/mocks'
import type { Category } from '@/types'

function parseCategory(data: unknown): Category | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseCategory(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.name) {
    return record as unknown as Category
  }

  if (record.data) {
    return parseCategory(record.data)
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

export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/webhook/categories/create`, {
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
    throw new Error('Erro ao criar categoria')
  }

  const category = parseCategory(result)
  if (!category) {
    throw new Error('Resposta inválida ao criar categoria')
  }

  return category
}

export async function updateCategory(
  id: string,
  data: Pick<Category, 'name' | 'description' | 'active'>
): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/webhook/categories/update`, {
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
    throw new Error('Erro ao atualizar categoria')
  }

  const category = parseCategory(result)
  if (!category) {
    throw new Error('Resposta inválida ao atualizar categoria')
  }

  return category
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhook/categories/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao inativar categoria')
  }
}
