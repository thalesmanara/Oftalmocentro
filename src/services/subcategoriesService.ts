import { API_BASE_URL } from './api'
import { mockSubcategories } from '@/data/mocks'
import type { Subcategory } from '@/types'

const CACHE_KEY = 'oftalmocentro_subcategories_cache'

function readCache(): Subcategory[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Subcategory[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mergeIntoCache(items: Subcategory[]): Subcategory[] {
  const byId = new Map(readCache().map((item) => [item.id, item]))
  for (const item of items) {
    byId.set(item.id, item)
  }
  const merged = Array.from(byId.values())
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(merged))
  return merged
}

function removeFromCache(id: string): void {
  const next = readCache().filter((item) => item.id !== id)
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(next))
}

function parseSubcategory(data: unknown): Subcategory | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    // Em listas, parseSubcategory individual deve ser usado por item.
    // Se chamado com array inteiro, trata cada item.
    return null
  }

  if (typeof data !== 'object') return null

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

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Aceita:
 * - array JSON (formato correto, igual categories)
 * - objeto único (formato atual do n8n — workaround)
 * - { data: [...] }
 */
function normalizeList(data: unknown): Subcategory[] {
  if (!data) return []

  if (Array.isArray(data)) {
    return data
      .map((item) => parseSubcategory(item))
      .filter((item): item is Subcategory => Boolean(item))
  }

  if (typeof data === 'object') {
    const record = data as Record<string, unknown>

    if (Array.isArray(record.data)) {
      return normalizeList(record.data)
    }

    if (Array.isArray(record.subcategories)) {
      return normalizeList(record.subcategories)
    }

    // Alguns workflows n8n devolvem vários itens como propriedades numeradas
    // { "0": {...}, "1": {...} }
    const numericKeys = Object.keys(record).filter((key) => /^\d+$/.test(key))
    if (numericKeys.length > 0) {
      return numericKeys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => parseSubcategory(record[key]))
        .filter((item): item is Subcategory => Boolean(item))
    }

    const single = parseSubcategory(record)
    return single ? [single] : []
  }

  return []
}

function filterByCategory(list: Subcategory[], categoryId?: string): Subcategory[] {
  if (!categoryId) return list
  return list.filter((item) => item.categoryId === categoryId)
}

export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  try {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
    const response = await fetch(`${API_BASE_URL}/webhook/subcategories${query}`)

    if (!response.ok) {
      throw new Error('Erro ao buscar subcategorias')
    }

    const data = await response.json()
    const fromApi = normalizeList(data)

    // Mescla API + cache da sessão.
    // Necessário enquanto o n8n devolver só o primeiro item (objeto) em vez de array.
    const merged = mergeIntoCache(fromApi)
    return filterByCategory(merged, categoryId)
  } catch (error) {
    console.warn('Usando subcategorias mockadas/cache por falha no webhook:', error)
    const cached = filterByCategory(readCache(), categoryId)
    if (cached.length > 0) return cached

    return filterByCategory(mockSubcategories, categoryId)
  }
}

async function resolveAfterMutation(
  result: unknown,
  match: { categoryId: string; name: string; id?: string }
): Promise<Subcategory> {
  const fromList = normalizeList(result)
  if (fromList.length === 1) {
    mergeIntoCache(fromList)
    return fromList[0]
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

  throw new Error('Resposta inválida ao salvar subcategoria')
}

export async function createSubcategory(
  data: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>
): Promise<Subcategory> {
  const response = await fetch(`${API_BASE_URL}/webhook/subcategories/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoryId: data.categoryId,
      name: data.name,
      description: data.description ?? null,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao criar subcategoria')
  }

  return resolveAfterMutation(result, {
    categoryId: data.categoryId,
    name: data.name,
  })
}

export async function updateSubcategory(
  id: string,
  data: Pick<Subcategory, 'categoryId' | 'name' | 'description' | 'active'>
): Promise<Subcategory> {
  const response = await fetch(`${API_BASE_URL}/webhook/subcategories/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description ?? null,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar subcategoria')
  }

  return resolveAfterMutation(result, {
    id,
    categoryId: data.categoryId,
    name: data.name,
  })
}

export async function deleteSubcategory(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhook/subcategories/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao inativar subcategoria')
  }

  removeFromCache(id)
}
