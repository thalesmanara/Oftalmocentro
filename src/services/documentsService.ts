import { API_BASE_URL } from './api'
import { mockDocuments } from '@/data/mocks'
import { getTags } from './tagsService'
import type { Document, DocumentFormData, Tag } from '@/types'
import { getDocumentTagIds } from '@/utils/document'

export interface DocumentFileUploadResult {
  id: string
  title: string
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  updatedAt: string
}

function normalizeExpirationDate(value: string | null | undefined): string | null {
  if (!value) return null
  return value.split('T')[0]
}

function normalizeDocument(doc: Document): Document {
  return {
    ...doc,
    tagIds: getDocumentTagIds(doc),
    tags: doc.tags ?? [],
    expirationDate: normalizeExpirationDate(doc.expirationDate),
  }
}

async function resolveTagsForPayload(
  tagIds: string[],
  existing: Document
): Promise<Pick<Tag, 'id' | 'name' | 'color' | 'active'>[]> {
  const catalog = await getTags()

  return tagIds.map((tagId) => {
    const fromCatalog = catalog.find((tag) => tag.id === tagId)
    const fromDocument = existing.tags?.find((tag) => tag.id === tagId)

    const tag = fromCatalog ?? fromDocument
    if (!tag) return { id: tagId, name: tagId, color: null, active: true }

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      active: tag.active,
    }
  })
}

async function buildUpdatePayload(
  existing: Document,
  data: DocumentFormData,
  userId: string
) {
  const tagIds = Array.from(new Set(data.tagIds ?? getDocumentTagIds(existing)))
  const tags = await resolveTagsForPayload(tagIds, existing)

  const merged = {
    ...existing,
    title: data.title.trim(),
    sectorId: data.sectorId,
    categoryId: data.categoryId,
    semanticDescription: data.semanticDescription.trim(),
    expirationDate: data.expirationDate!,
    tagIds,
    tags,
  }

  return {
    id: existing.id,
    title: merged.title,
    sectorId: merged.sectorId,
    categoryId: merged.categoryId,
    semanticDescription: merged.semanticDescription,
    expirationDate: merged.expirationDate,
    tagIds,
    tags,
    fileName: existing.fileName ?? null,
    fileType: existing.fileType ?? null,
    fileSize: existing.fileSize ?? null,
    filePath: existing.filePath ?? null,
    extractedText: existing.extractedText ?? null,
    responsibleUserId: existing.responsibleUserId ?? userId,
    updatedBy: userId,
  }
}

function parseDocument(data: unknown): Document | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseDocument(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.title) {
    return normalizeDocument(record as unknown as Document)
  }

  if (record.document) {
    return parseDocument(record.document)
  }

  if (record.data) {
    return parseDocument(record.data)
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

async function resolveDocumentAfterCreate(
  result: unknown,
  match: { title: string; sectorId: string; categoryId: string }
): Promise<Document> {
  const parsed = parseDocument(result)
  if (parsed) return parsed

  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : null
  if (record?.success === true) {
    const documents = await getDocuments()
    const found = documents
      .filter(
        (doc) =>
          doc.title === match.title &&
          doc.sectorId === match.sectorId &&
          doc.categoryId === match.categoryId
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    if (found) return found
  }

  throw new Error('Resposta inválida ao criar documento')
}

async function resolveDocumentAfterUpdate(_result: unknown, id: string): Promise<Document> {
  const refreshed = await getDocumentById(id)
  if (refreshed) return refreshed

  throw new Error('Resposta inválida ao atualizar documento')
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

export async function createDocument(
  data: DocumentFormData,
  userId: string,
  _userName: string
): Promise<Document> {
  if (!data.expirationDate) {
    throw new Error('Data de validade é obrigatória')
  }

  const response = await fetch(`${API_BASE_URL}/webhook/documents/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: data.title.trim(),
      sectorId: data.sectorId,
      categoryId: data.categoryId,
      semanticDescription: data.semanticDescription.trim(),
      expirationDate: data.expirationDate,
      tagIds: data.tagIds,
      fileName: null,
      fileType: null,
      fileSize: null,
      filePath: null,
      extractedText: null,
      responsibleUserId: userId,
      createdBy: userId,
      updatedBy: userId,
    }),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao criar documento')
  }

  return resolveDocumentAfterCreate(result, {
    title: data.title.trim(),
    sectorId: data.sectorId,
    categoryId: data.categoryId,
  })
}

export async function updateDocument(
  id: string,
  data: DocumentFormData,
  userId: string,
  _userName: string,
  currentDocument?: Document
): Promise<Document> {
  if (!data.expirationDate) {
    throw new Error('Data de validade é obrigatória')
  }

  const existing = currentDocument ?? (await getDocumentById(id))
  if (!existing) {
    throw new Error('Documento não encontrado')
  }

  const payload = await buildUpdatePayload(existing, data, userId)

  const response = await fetch(`${API_BASE_URL}/webhook/documents/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const result = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error('Erro ao atualizar documento')
  }

  return resolveDocumentAfterUpdate(result, id)
}

function parseUploadResult(data: unknown): DocumentFileUploadResult | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseUploadResult(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.fileName) {
    return record as unknown as DocumentFileUploadResult
  }

  if (record.data) {
    return parseUploadResult(record.data)
  }

  return null
}

export async function uploadDocumentFile(
  documentId: string,
  file: File
): Promise<DocumentFileUploadResult> {
  const formData = new FormData()
  formData.append('documentId', documentId)
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/webhook/documents/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Erro ao enviar arquivo do documento')
  }

  const result = await parseJsonResponse(response)
  const parsed = parseUploadResult(result)

  if (parsed) return parsed

  const refreshed = await getDocumentById(documentId)
  if (refreshed?.fileName) {
    return {
      id: refreshed.id,
      title: refreshed.title,
      fileName: refreshed.fileName,
      fileType: refreshed.fileType ?? '',
      fileSize: refreshed.fileSize ?? 0,
      filePath: refreshed.filePath ?? '',
      updatedAt: refreshed.updatedAt,
    }
  }

  throw new Error('Resposta inválida ao enviar arquivo do documento')
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhook/documents/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error('Erro ao excluir documento')
  }
}
