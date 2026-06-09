import { API_BASE_URL, mockDelay } from './api'
import { mockDocuments } from '@/data/mocks'
import { getCategories } from './categoriesService'
import { getSectors } from './sectorsService'
import { getTags } from './tagsService'
import type { Document, DocumentFormData } from '@/types'
import { getCategoryNameById, getSectorNameById, getTagsByIds } from '@/utils/entities'

function normalizeExpirationDate(value: string | null | undefined): string | null {
  if (!value) return null
  return value.split('T')[0]
}

function normalizeDocument(doc: Document): Document {
  return {
    ...doc,
    tagIds: doc.tagIds ?? [],
    tags: doc.tags ?? [],
    expirationDate: normalizeExpirationDate(doc.expirationDate),
  }
}

async function resolveDocumentNames(
  data: DocumentFormData
): Promise<Pick<Document, 'sectorName' | 'categoryName' | 'tags'>> {
  const [sectors, categories, tags] = await Promise.all([
    getSectors(),
    getCategories(),
    getTags(),
  ])
  const sectorName = getSectorNameById(data.sectorId, sectors)
  const categoryName = getCategoryNameById(data.categoryId, categories)
  const resolvedTags = getTagsByIds(data.tagIds, tags)

  return {
    sectorName,
    categoryName,
    tags: resolvedTags.length ? resolvedTags : undefined,
  }
}

export async function getDocuments(): Promise<Document[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/documents`)

    if (!response.ok) {
      throw new Error('Erro ao buscar documentos')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data.map((doc) => normalizeDocument(doc as Document))
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data.map((doc: Document) => normalizeDocument(doc))
    }

    return mockDocuments
  } catch (error) {
    console.warn('Usando documentos mockados por falha no webhook:', error)
    return mockDocuments
  }
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const documents = await getDocuments()
  return documents.find((d) => d.id === id) ?? null
}

// Futuro: POST `${API_BASE_URL}/webhook/documents/create`
export async function createDocument(
  data: DocumentFormData,
  userId: string,
  userName: string
): Promise<Document> {
  const id = `doc-${Date.now()}`
  const now = new Date().toISOString()
  const file = data.file
  const names = await resolveDocumentNames(data)

  const doc: Document = {
    id,
    title: data.title,
    sectorId: data.sectorId,
    categoryId: data.categoryId,
    semanticDescription: data.semanticDescription,
    tagIds: data.tagIds,
    expirationDate: data.expirationDate,
    fileName: file?.name ?? 'sem-arquivo.txt',
    fileType: file?.type ?? 'text/plain',
    fileSize: file?.size ?? 0,
    filePath: `/uploads/${file?.name ?? 'sem-arquivo.txt'}`,
    extractedText: `[Mock] Texto extraído do documento "${data.title}" para indexação futura.`,
    responsibleUserId: userId,
    responsibleUserName: userName,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    createdByName: userName,
    updatedBy: userId,
    updatedByName: userName,
    ...names,
  }

  mockDocuments.unshift(doc)
  return mockDelay(doc)
}

// Futuro: PUT `${API_BASE_URL}/webhook/documents/update`
export async function updateDocument(
  id: string,
  data: Partial<DocumentFormData>,
  userId: string,
  userName: string
): Promise<Document | null> {
  const index = mockDocuments.findIndex((d) => d.id === id)
  if (index === -1) return mockDelay(null)

  const existing = mockDocuments[index]
  const file = data.file
  const merged: DocumentFormData = {
    title: data.title ?? existing.title,
    sectorId: data.sectorId ?? existing.sectorId,
    categoryId: data.categoryId ?? existing.categoryId,
    semanticDescription: data.semanticDescription ?? existing.semanticDescription,
    tagIds: data.tagIds ?? existing.tagIds,
    expirationDate: data.expirationDate !== undefined ? data.expirationDate : existing.expirationDate,
    file: data.file,
  }
  const names = await resolveDocumentNames(merged)

  const updated: Document = {
    ...existing,
    title: merged.title,
    sectorId: merged.sectorId,
    categoryId: merged.categoryId,
    semanticDescription: merged.semanticDescription,
    tagIds: merged.tagIds,
    expirationDate: merged.expirationDate,
    ...names,
    ...(file
      ? {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: `/uploads/${file.name}`,
        }
      : {}),
    responsibleUserId: userId,
    responsibleUserName: userName,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    updatedByName: userName,
  }

  mockDocuments[index] = updated
  return mockDelay(updated)
}

// Futuro: DELETE `${API_BASE_URL}/webhook/documents/delete`
export async function deleteDocument(id: string): Promise<boolean> {
  const index = mockDocuments.findIndex((d) => d.id === id)
  if (index === -1) return mockDelay(false)
  mockDocuments.splice(index, 1)
  return mockDelay(true)
}
