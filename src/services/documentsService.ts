import { mockDelay } from './api'
import { mockDocuments } from '@/data/mocks'
import type { Document, DocumentFormData } from '@/types'

// Futuro: GET ${API_BASE_URL}/documents → getDocuments()

export async function getDocuments(): Promise<Document[]> {
  return mockDelay([...mockDocuments])
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const doc = mockDocuments.find((d) => d.id === id)
  return mockDelay(doc ?? null)
}

export async function createDocument(
  data: DocumentFormData,
  userId: string,
  userName: string
): Promise<Document> {
  const id = `doc-${Date.now()}`
  const now = new Date().toISOString()
  const file = data.arquivo

  const doc: Document = {
    id,
    titulo: data.titulo,
    setor: data.setor,
    categoria: data.categoria,
    descricaoSemantica: data.descricaoSemantica,
    tags: data.tags,
    dataValidade: data.dataValidade,
    nomeArquivo: file?.name ?? 'sem-arquivo.txt',
    tipoArquivo: file?.type ?? 'text/plain',
    tamanhoArquivo: file?.size ?? 0,
    caminhoArquivo: `/uploads/${file?.name ?? 'sem-arquivo.txt'}`,
    textoExtraido: `[Mock] Texto extraído do documento "${data.titulo}" para indexação futura.`,
    usuarioResponsavel: userName,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  }

  mockDocuments.unshift(doc)
  return mockDelay(doc)
}

export async function updateDocument(
  id: string,
  data: Partial<DocumentFormData>,
  userId: string,
  userName: string
): Promise<Document | null> {
  const index = mockDocuments.findIndex((d) => d.id === id)
  if (index === -1) return mockDelay(null)

  const existing = mockDocuments[index]
  const file = data.arquivo
  const updated: Document = {
    ...existing,
    titulo: data.titulo ?? existing.titulo,
    setor: data.setor ?? existing.setor,
    categoria: data.categoria ?? existing.categoria,
    descricaoSemantica: data.descricaoSemantica ?? existing.descricaoSemantica,
    tags: data.tags ?? existing.tags,
    dataValidade: data.dataValidade !== undefined ? data.dataValidade : existing.dataValidade,
    ...(file
      ? {
          nomeArquivo: file.name,
          tipoArquivo: file.type,
          tamanhoArquivo: file.size,
          caminhoArquivo: `/uploads/${file.name}`,
        }
      : {}),
    usuarioResponsavel: userName,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  }

  mockDocuments[index] = updated
  return mockDelay(updated)
}

export async function deleteDocument(id: string): Promise<boolean> {
  const index = mockDocuments.findIndex((d) => d.id === id)
  if (index === -1) return mockDelay(false)
  mockDocuments.splice(index, 1)
  return mockDelay(true)
}

// Futuro: POST FormData via buildDocumentFormData() em api.ts
