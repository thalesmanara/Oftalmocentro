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
  return categories.find((c) => c.id === categoryId)?.name ?? fallback ?? '—'
}

export function getTagNamesByIds(tagIds: string[], tags: Tag[]): string[] {
  return tagIds
    .map((id) => tags.find((t) => t.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}
