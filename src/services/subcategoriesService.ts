import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api'
import { expectArray } from '@/utils/expectArray'
import type { Subcategory } from '@/types'

/**
 * Cache de sessão (somente respostas reais da API).
 * Nunca é usado como fallback após 401/403/500.
 * Invalidado parcialmente após create/update/delete.
 */
const SESSION_CACHE_KEY = 'oftalmocentro_subcategories_session'

function readSessionCache(): Subcategory[] {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Subcategory[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessionCache(items: Subcategory[]): void {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(items))
  } catch {
    // quota / private mode — cache é opcional
  }
}

/** Remove cache persistente legado (localStorage) se ainda existir. */
function clearLegacyPersistentCache(): void {
  try {
    localStorage.removeItem('oftalmocentro_subcategories_cache')
  } catch {
    // ignore
  }
}

clearLegacyPersistentCache()

function replaceCategoryInCache(categoryId: string | undefined, items: Subcategory[]): void {
  if (!categoryId) {
    writeSessionCache(items)
    return
  }
  const others = readSessionCache().filter((item) => item.categoryId !== categoryId)
  writeSessionCache([...others, ...items])
}

function upsertInCache(items: Subcategory[]): void {
  if (!items.length) return
  const byId = new Map(readSessionCache().map((item) => [item.id, item]))
  for (const item of items) {
    byId.set(item.id, item)
  }
  writeSessionCache(Array.from(byId.values()))
}

function removeFromCache(id: string): void {
  writeSessionCache(readSessionCache().filter((item) => item.id !== id))
}

/** Atualiza cache de sessão com itens reais (após mutação bem-sucedida na UI). */
export function rememberSubcategories(items: Subcategory[]): Subcategory[] {
  upsertInCache(items)
  return readSessionCache()
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
        record.description === undefined ? null : (record.description as string | null),
      active: record.active !== false,
      createdAt: record.createdAt != null ? String(record.createdAt) : undefined,
      updatedAt: record.updatedAt != null ? String(record.updatedAt) : undefined,
    }
  }

  return null
}

function normalizeList(data: unknown): Subcategory[] {
  return expectArray(data, 'subcategorias')
    .map((item) => parseSubcategory(item))
    .filter((item): item is Subcategory => Boolean(item))
}

function sortByName(list: Subcategory[]): Subcategory[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Sempre busca na API. Em erro, propaga ApiError (não devolve cache).
 * Cache de sessão só é atualizado após sucesso.
 */
export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
  const data = await apiGet<unknown>(`/webhook/subcategories${query}`)
  const fromApi = normalizeList(data)
  replaceCategoryInCache(categoryId, fromApi)
  return sortByName(fromApi)
}

async function resolveAfterMutation(
  result: unknown,
  match: { categoryId: string; name: string; id?: string }
): Promise<Subcategory> {
  let fromList: Subcategory[] = []
  if (Array.isArray(result)) {
    fromList = result
      .map((item) => parseSubcategory(item))
      .filter((item): item is Subcategory => Boolean(item))
  } else {
    const single = parseSubcategory(result)
    if (single) fromList = [single]
  }

  if (fromList.length >= 1) {
    const preferred =
      (match.id ? fromList.find((item) => item.id === match.id) : undefined) ??
      fromList.find(
        (item) => item.name.trim().toLowerCase() === match.name.trim().toLowerCase()
      ) ??
      fromList[0]
    upsertInCache(fromList)
    return preferred
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

  const cached = readSessionCache()
  const current = cached.find((item) => item.id === id)
  if (current) {
    upsertInCache([{ ...current, active: false }])
  } else {
    removeFromCache(id)
  }
}
