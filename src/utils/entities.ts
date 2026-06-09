import type { Category, Sector, Tag } from '@/types'

export function getSectorNameById(
  sectorId: string | null | undefined,
  sectors: Sector[],
  fallback?: string
): string {
  if (!sectorId) return fallback ?? '—'
  return sectors.find((s) => s.id === sectorId)?.name ?? fallback ?? '—'
}

export function getCategoryNameById(
  categoryId: string | null | undefined,
  categories: Category[],
  fallback?: string
): string {
  if (!categoryId) return fallback ?? '—'
  return (
    categories.find((c) => c.id === categoryId)?.name ??
    fallback ??
    'Categoria não encontrada'
  )
}

export function getTagsByIds(tagIds: string[], tags: Tag[]): Tag[] {
  return tags.filter((tag) => tagIds.includes(tag.id))
}

export function getTagNameById(tagId: string | null | undefined, tags: Tag[]): string {
  if (!tagId) return '—'
  return tags.find((t) => t.id === tagId)?.name ?? 'Tag não encontrada'
}

export function getTagNamesByIds(tagIds: string[], tags: Tag[]): string[] {
  return tagIds
    .map((id) => getTagNameById(id, tags))
    .filter((name) => name !== 'Tag não encontrada')
}
