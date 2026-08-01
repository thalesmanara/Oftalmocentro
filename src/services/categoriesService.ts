import { ApiError, request } from './api'
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

  return null
}

export async function getCategories(): Promise<Category[]> {
  const data = await request<unknown>('/webhook/categories')
  if (!Array.isArray(data)) return []
  return data.filter((item): item is Category => Boolean(parseCategory(item)))
}

export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const result = await request<unknown>('/webhook/categories/create', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      active: data.active,
    }),
  })

  const category = parseCategory(result)
  if (!category) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao criar categoria',
    })
  }

  return category
}

export async function updateCategory(
  id: string,
  data: Pick<Category, 'name' | 'description' | 'active'>
): Promise<Category> {
  const result = await request<unknown>('/webhook/categories/update', {
    method: 'PUT',
    body: JSON.stringify({
      id,
      name: data.name,
      description: data.description,
      active: data.active,
    }),
  })

  const category = parseCategory(result)
  if (!category) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao atualizar categoria',
    })
  }

  return category
}

export async function deleteCategory(id: string): Promise<void> {
  await request<unknown>('/webhook/categories/delete', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
