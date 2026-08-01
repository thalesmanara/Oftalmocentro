import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api'
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
  const data = await apiGet<unknown>('/webhook/categories')
  if (!Array.isArray(data)) return []
  return data.filter((item): item is Category => Boolean(parseCategory(item)))
}

export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const result = await apiPost<unknown>('/webhook/categories/create', {
    name: data.name,
    description: data.description,
    active: data.active,
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
  const result = await apiPut<unknown>('/webhook/categories/update', {
    id,
    name: data.name,
    description: data.description,
    active: data.active,
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
  await apiDelete('/webhook/categories/delete', { id })
}
