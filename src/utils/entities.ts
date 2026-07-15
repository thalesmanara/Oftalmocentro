import type { Category, Sector, Subcategory } from '@/types'

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

export function getSubcategoryNameById(
  subcategoryId: string | null | undefined,
  subcategories: Subcategory[],
  fallback?: string
): string {
  if (!subcategoryId) return fallback ?? 'Não informada'
  return (
    subcategories.find((s) => s.id === subcategoryId)?.name ??
    fallback ??
    'Subcategoria não encontrada'
  )
}
