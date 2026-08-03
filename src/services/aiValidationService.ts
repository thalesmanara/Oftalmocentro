import { apiGet, apiPost } from './api'

/** Etapa 16 — Framework de validação da IA (Consulta IA). */

export type AiCaseStatus = 'active' | 'inactive' | string
export type AiRunStatus = 'STARTED' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'ERROR' | string
export type AiRunTriggerMode = 'dataset' | 'single' | string
export type AiVerdict = 'PASS' | 'FAIL' | 'ERROR' | string

export interface AiTestCase {
  id: string
  code: string
  name: string
  groupName: string
  testType: string
  categoryName?: string | null
  subcategoryName?: string | null
  expectedDocumentId?: string | null
  expectedDocumentIds?: string[]
  question: string
  expectedAnswer?: string | null
  requiredWords: string[]
  forbiddenWords: string[]
  requiredSourceDocumentId?: string | null
  minScore: number
  expectNoAnswer: boolean
  notes?: string | null
  status: AiCaseStatus
  version: number
  dependsOnMissingDocs: boolean
  createdAt: string
  updatedAt: string
}

export interface AiTestRun {
  id: string
  startedAt: string
  finishedAt?: string | null
  durationMs?: number | null
  status: AiRunStatus
  triggeredBy?: string | null
  triggerMode: AiRunTriggerMode
  totalCases: number
  passedCount: number
  failedCount: number
  errorCount: number
  skippedCount: number
  overallScore?: number | null
  promptVersion?: string | null
  modelName?: string | null
  ocrEngineVersion?: string | null
  tabularEngineVersion?: string | null
  embeddingModel?: string | null
  embeddingVersion?: string | null
  report?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface AiScoreBreakdown {
  answerQuality: number
  sources: number
  document: number
  latency: number
  weights: { answerQuality: number; sources: number; document: number; latency: number }
  formula?: string
}

export interface AiTestResult {
  id: string
  runId: string
  caseId: string
  caseCode?: string | null
  question: string
  answer?: string | null
  durationMs?: number | null
  sources?: Array<Record<string, unknown>>
  chunkRefs?: Array<Record<string, unknown>>
  classification?: Record<string, unknown> | null
  matchedDocument?: boolean | null
  matchedCategory?: boolean | null
  matchedSubcategory?: boolean | null
  requiredWordsHit: number
  requiredWordsTotal: number
  forbiddenWordsHit: number
  sourcesCorrect?: boolean | null
  sourcesIncorrect?: boolean | null
  isHallucination: boolean
  isEmptyAnswer: boolean
  isInternalError: boolean
  score?: number | null
  verdict: AiVerdict
  scoreBreakdown?: AiScoreBreakdown
  extractionMethod?: string | null
  ocrQualityGrade?: string | null
  ocrUsed?: boolean | null
  sheetName?: string | null
  promptVersion?: string | null
  modelName?: string | null
  createdAt: string
}

export interface AiCategoryCoverageEntry {
  total: number
  passed: number
  precision: number
}

export interface AiTopError {
  caseCode?: string
  verdict: string
  score?: number
  question?: string
}

export interface AiTopDocument {
  documentId: string
  title?: string
  count: number
}

export interface AiTestMetrics {
  id: string
  runId: string
  precision?: number | null
  recall?: number | null
  documentCoverage?: number | null
  categoryCoverage?: Record<string, AiCategoryCoverageEntry>
  avgDurationMs?: number | null
  minDurationMs?: number | null
  maxDurationMs?: number | null
  sourcesCorrectCount: number
  sourcesIncorrectCount: number
  documentCorrectCount: number
  categoryCorrectCount: number
  subcategoryCorrectCount: number
  hallucinationCount: number
  emptyAnswerCount: number
  internalErrorCount: number
  passedCount: number
  failedCount: number
  totalCount: number
  overallScore?: number | null
  topErrors?: AiTopError[]
  topDocuments?: AiTopDocument[]
  scoreFormula?: string
  createdAt: string
}

export interface AiEvalPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AiCaseFilters {
  groupName?: string
  testType?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface AiCaseGroupSummary {
  total: number
  [key: string]: unknown
}

export interface AiCasesResult {
  items: AiTestCase[]
  pagination?: AiEvalPagination
  summaryByGroup?: Record<string, AiCaseGroupSummary>
}

export interface AiRunFilters {
  page?: number
  pageSize?: number
}

export interface AiRunsResult {
  items: AiTestRun[]
  pagination?: AiEvalPagination
}

export interface AiRunDetailResult {
  run: AiTestRun
  metrics: AiTestMetrics | null
  results: AiTestResult[]
  report?: Record<string, unknown>
}

export interface AiRunCaseInput {
  caseId?: string
  caseCode?: string
  /** Etapa 17 — executa o caso usando uma versão específica de prompt (governança). */
  promptVersionId?: string
}

export interface AiRunCaseResult {
  run: AiTestRun
  result: AiTestResult
}

export interface AiRunDatasetInput {
  groupName?: string
  includeMissingDocs?: boolean
  /** Etapa 17 — executa o dataset usando uma versão específica de prompt (governança). */
  promptVersionId?: string
}

export interface AiRunDatasetResult {
  run: AiTestRun
  metrics?: AiTestMetrics | null
  results?: AiTestResult[]
}

export interface AiExportPayload {
  run: AiTestRun
  metrics?: AiTestMetrics | null
  results: AiTestResult[]
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** Lista de casos de teste cadastrados (editar_configuracoes). */
export async function getAiTestCases(filters: AiCaseFilters = {}): Promise<AiCasesResult> {
  const qs = buildQuery({
    groupName: filters.groupName,
    testType: filters.testType,
    status: filters.status,
    page: filters.page,
    pageSize: filters.pageSize,
  })
  return apiGet<AiCasesResult>(`/webhook/system/ai-eval/cases${qs}`)
}

/** Histórico de execuções do dataset de validação. */
export async function getAiTestRuns(filters: AiRunFilters = {}): Promise<AiRunsResult> {
  const qs = buildQuery({ page: filters.page, pageSize: filters.pageSize })
  return apiGet<AiRunsResult>(`/webhook/system/ai-eval/runs${qs}`)
}

/** Detalhe de uma execução: métricas agregadas e resultados por caso. */
export async function getAiTestRunDetail(runId: string): Promise<AiRunDetailResult> {
  return apiGet<AiRunDetailResult>(
    `/webhook/system/ai-eval/runs/detail?runId=${encodeURIComponent(runId)}`
  )
}

/** Executa um único caso de teste sob demanda. */
export async function runAiTestCase(input: AiRunCaseInput): Promise<AiRunCaseResult> {
  return apiPost<AiRunCaseResult>('/webhook/system/ai-eval/run-case', input, {
    timeoutMs: 60000,
  })
}

/** Executa o dataset completo (ou um grupo específico) de validação. */
export async function runAiTestDataset(
  input: AiRunDatasetInput = {}
): Promise<AiRunDatasetResult> {
  return apiPost<AiRunDatasetResult>('/webhook/system/ai-eval/run-dataset', input, {
    timeoutMs: 45 * 60 * 1000,
  })
}

async function fetchExportPayload(runId: string): Promise<AiExportPayload> {
  return apiGet<AiExportPayload>(
    `/webhook/system/ai-eval/export?runId=${encodeURIComponent(runId)}&format=json`
  )
}

function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function resultsToCsv(results: AiTestResult[]): string {
  const headers = [
    'caseCode',
    'question',
    'verdict',
    'score',
    'durationMs',
    'isHallucination',
    'isEmptyAnswer',
    'isInternalError',
    'requiredWordsHit',
    'requiredWordsTotal',
  ]
  const lines = [headers.join(',')]
  for (const r of results) {
    lines.push(
      [
        r.caseCode ?? '',
        r.question,
        r.verdict,
        r.score ?? '',
        r.durationMs ?? '',
        r.isHallucination,
        r.isEmptyAnswer,
        r.isInternalError,
        r.requiredWordsHit,
        r.requiredWordsTotal,
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  return lines.join('\n')
}

/** Exporta o relatório de uma execução em JSON ou CSV (download no navegador). */
export async function exportAiTestRun(runId: string, format: 'json' | 'csv'): Promise<void> {
  const payload = await fetchExportPayload(runId)
  if (format === 'json') {
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `ai-eval-run-${runId}.json`,
      'application/json'
    )
    return
  }
  downloadTextFile(resultsToCsv(payload.results ?? []), `ai-eval-run-${runId}.csv`, 'text/csv;charset=utf-8')
}
