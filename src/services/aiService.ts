import { API_BASE_URL } from './api'

export interface AISource {
  index: number
  documentId: string
  documentTitle: string
  sectorName?: string
  categoryName?: string
  chunkOrder?: number
}

export interface AIResponse {
  success: boolean
  answer: string
  sources: AISource[]
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

function parseSource(data: unknown): AISource | null {
  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  const documentId = String(record.documentId ?? record.document_id ?? '')
  const documentTitle = String(record.documentTitle ?? record.document_title ?? '')

  if (!documentId && !documentTitle) return null

  return {
    index: Number(record.index ?? 0),
    documentId,
    documentTitle,
    sectorName: record.sectorName != null ? String(record.sectorName) : undefined,
    categoryName: record.categoryName != null ? String(record.categoryName) : undefined,
    chunkOrder:
      record.chunkOrder != null
        ? Number(record.chunkOrder)
        : record.chunk_order != null
          ? Number(record.chunk_order)
          : undefined,
  }
}

function parseAIResponse(data: unknown): AIResponse | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseAIResponse(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.data) {
    return parseAIResponse(record.data)
  }

  if (record.success === false) {
    return {
      success: false,
      answer: String(record.message ?? record.answer ?? ''),
      sources: [],
    }
  }

  const answer = record.answer != null ? String(record.answer) : ''
  const sources = Array.isArray(record.sources)
    ? record.sources.map(parseSource).filter((item): item is AISource => Boolean(item))
    : []

  return {
    success: record.success !== false,
    answer,
    sources,
  }
}

export async function askAI(question: string): Promise<AIResponse> {
  const trimmed = question.trim()
  if (!trimmed) {
    throw new Error('Digite uma pergunta antes de consultar a IA.')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/webhook/consulta-ia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: trimmed }),
    })
  } catch {
    throw new Error('Não foi possível consultar a IA no momento. Tente novamente.')
  }

  let result: unknown

  try {
    result = await parseJsonResponse(response)
  } catch {
    throw new Error('Não foi possível consultar a IA no momento. Tente novamente.')
  }

  if (!response.ok) {
    throw new Error('Não foi possível consultar a IA no momento. Tente novamente.')
  }

  const parsed = parseAIResponse(result)

  if (!parsed) {
    throw new Error('Não foi possível consultar a IA no momento. Tente novamente.')
  }

  if (parsed.success === false) {
    throw new Error('Não foi possível consultar a IA no momento. Tente novamente.')
  }

  return parsed
}
