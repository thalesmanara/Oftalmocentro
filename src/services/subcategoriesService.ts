import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api'
import type { Subcategory } from '@/types'

const CACHE_KEY = 'oftalmocentro_subcategories_cache'

function readCache(): Subcategory[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Subcategory[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCache(items: Subcategory[]): Subcategory[] {
  const serialized = JSON.stringify(items)
  localStorage.setItem(CACHE_KEY, serialized)
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
  return items
}

/** Persiste subcategorias conhecidas (create/update/listagem na UI). */
export function rememberSubcategories(items: Subcategory[]): Subcategory[] {
  if (!items.length) return readCache()
  return mergeIntoCache(items)
}

function mergeIntoCache(items: Subcategory[]): Subcategory[] {
  const byId = new Map(readCache().map((item) => [item.id, item]))
  for (const item of items) {
    byId.set(item.id, item)
  }
  return writeCache(Array.from(byId.values()))
}

function removeFromCache(id: string): void {
  writeCache(readCache().filter((item) => item.id !== id))
}

function parseSubcategory(data: unknown): Subcategory | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const record = data as Record<string, unknown>

  if (record.data && !record.id) {
    return parseSubcategory(record.data)
  }

  if (record.subcategory) {
    return parseSubcategory(record.subcategory)
  }

  const categoryId = record.categoryId ?? record.category_id
  const id = record.id
  const name = record.name

  if (id && name && categoryId) {
    return {
      id: String(id),
      categoryId: String(categoryId),
      categoryName:
        record.categoryName != null
          ? String(record.categoryName)
          : record.category_name != null
            ? String(record.category_name)
            : undefined,
      name: String(name),
      description:
        record.description === undefined
          ? null
          : (record.description as string | null),
      active: record.active !== false,
      createdAt: record.createdAt != null ? String(record.createdAt) : undefined,
      updatedAt: record.updatedAt != null ? String(record.updatedAt) : undefined,
    }
  }

  return null
}

function normalizeList(data: unknown): Subcategory[] {
  if (!data) return []

  if (Array.isArray(data)) {
    return data
      .map((item) => parseSubcategory(item))
      .filter((item): item is Subcategory => Boolean(item))
  }

  const single = parseSubcategory(data)
  return single ? [single] : []
}

function filterByCategory(list: Subcategory[], categoryId?: string): Subcategory[] {
  if (!categoryId) return list
  return list.filter((item) => item.categoryId === categoryId)
}

function sortByName(list: Subcategory[]): Subcategory[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
  const data = await apiGet<unknown>(`/webhook/subcategories${query}`)
  const fromApi = normalizeList(data)
  const merged = mergeIntoCache(fromApi)
  return sortByName(filterByCategory(merged, categoryId))
}

async function resolveAfterMutation(
  result: unknown,
  match: { categoryId: string; name: string; id?: string }
): Promise<Subcategory> {
  const fromList = normalizeList(result)
  if (fromList.length >= 1) {
    const preferred =
      (match.id ? fromList.find((item) => item.id === match.id) : undefined) ??
      fromList.find(
        (item) => item.name.trim().toLowerCase() === match.name.trim().toLowerCase()
      ) ??
      fromList[0]
    mergeIntoCache(fromList)
    return preferred
  }

  const parsed = parseSubcategory(result)
  if (parsed) {
    mergeIntoCache([parsed])
    return parsed
  }

  const list = await getSubcategories(match.categoryId)
  const found = match.id
    ? list.find((item) => item.id === match.id)
    : list
        .filter((item) => item.name.trim().toLowerCase() === match.name.trim().toLowerCase())
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return bTime - aTime
        })[0]

  if (found) return found

  throw new ApiError({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Resposta inválida ao salvar subcategoria',
  })
}

export async function createSubcategory(
  data: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>
): Promise<Subcategory> {
  const result = await apiPost<unknown>('/webhook/subcategories/create', {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description ?? null,
    active: data.active,
  })

  return resolveAfterMutation(result, {
    categoryId: data.categoryId,
    name: data.name,
  })
}

export async function updateSubcategory(
  id: string,
  data: Pick<Subcategory, 'categoryId' | 'name' | 'description' | 'active'>
): Promise<Subcategory> {
  const result = await apiPut<unknown>('/webhook/subcategories/update', {
    id,
    categoryId: data.categoryId,
    name: data.name,
    description: data.description ?? null,
    active: data.active,
  })

  return resolveAfterMutation(result, {
    id,
    categoryId: data.categoryId,
    name: data.name,
  })
}

export async function deleteSubcategory(id: string): Promise<void> {
  await apiDelete('/webhook/subcategories/delete', { id })

  const cached = readCache()
  const current = cached.find((item) => item.id === id)
  if (current) {
    mergeIntoCache([{ ...current, active: false }])
  } else {
    removeFromCache(id)
  }
}
