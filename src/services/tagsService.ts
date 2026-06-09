import { API_BASE_URL } from './api'
import { mockTags } from '@/data/mocks'
import type { Tag } from '@/types'

function parseTag(data: unknown): Tag | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseTag(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.name) {
    return record as unknown as Tag
  }

  if (record.data) {
    return parseTag(record.data)
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

export async function createTag(
  data: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Tag> {
  const response = await fetch(`${API_BASE_URL}/webhook/tags/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      color: data.color,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao criar tag')
  }

  const tag = parseTag(result)
  if (!tag) {
    throw new Error('Resposta inválida ao criar tag')
  }

  return tag
}

export async function updateTag(
  id: string,
  data: Pick<Tag, 'name' | 'color' | 'active'>
): Promise<Tag> {
  const response = await fetch(`${API_BASE_URL}/webhook/tags/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: data.name,
      color: data.color,
      active: data.active,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar tag')
  }

  const tag = parseTag(result)
  if (!tag) {
    throw new Error('Resposta inválida ao atualizar tag')
  }

  return tag
}

export async function deleteTag(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhook/tags/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao inativar tag')
  }
}
