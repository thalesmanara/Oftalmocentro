import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, PlayCircle, Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { getErrorMessage } from '@/utils/apiError'
import {
  exportAiTestRun,
  getAiTestCases,
  getAiTestRunDetail,
  getAiTestRuns,
  runAiTestCase,
  runAiTestDataset,
  type AiCaseFilters,
  type AiRunDetailResult,
  type AiTestCase,
  type AiTestRun,
} from '@/services/aiValidationService'

type TabKey = 'casos' | 'historico' | 'resultado'

const emptyCaseFilters: AiCaseFilters = { groupName: '', testType: '', status: '' }

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function formatMs(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function statusTone(status?: string): string {
  switch (status) {
    case 'SUCCESS':
    case 'PASS':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'FAILED':
    case 'FAIL':
    case 'ERROR':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'STARTED':
      return 'bg-slate-50 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function verdictBadgeVariant(verdict?: string): 'success' | 'danger' | 'warning' | 'default' {
  if (verdict === 'PASS') return 'success'
  if (verdict === 'FAIL') return 'danger'
  if (verdict === 'ERROR') return 'warning'
  return 'default'
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>
          {value.toFixed(1)} / {max}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--color-primary,#0d4f8b)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function AiValidationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('casos')

  const [caseFilters, setCaseFilters] = useState<AiCaseFilters>(emptyCaseFilters)
  const [appliedCaseFilters, setAppliedCaseFilters] = useState<AiCaseFilters>(emptyCaseFilters)
  const [cases, setCases] = useState<AiTestCase[]>([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [casesError, setCasesError] = useState<string | null>(null)
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null)

  const [runs, setRuns] = useState<AiTestRun[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runDetail, setRunDetail] = useState<AiRunDetailResult | null>(null)
  const [runDetailLoading, setRunDetailLoading] = useState(false)
  const [runDetailError, setRunDetailError] = useState<string | null>(null)
  const [resultVerdictFilter, setResultVerdictFilter] = useState('')
  const [resultSearch, setResultSearch] = useState('')

  const [includeMissingDocs, setIncludeMissingDocs] = useState(false)
  const [runningDataset, setRunningDataset] = useState(false)
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const loadCases = useCallback(async (filters: AiCaseFilters) => {
    setCasesLoading(true)
    setCasesError(null)
    try {
      const result = await getAiTestCases(filters)
      setCases(result.items)
    } catch (err) {
      setCases([])
      setCasesError(getErrorMessage(err, 'Erro ao carregar casos de teste.'))
    } finally {
      setCasesLoading(false)
    }
  }, [])

  const loadRunDetail = useCallback(async (runId: string) => {
    setRunDetailLoading(true)
    setRunDetailError(null)
    try {
      const detail = await getAiTestRunDetail(runId)
      setRunDetail(detail)
    } catch (err) {
      setRunDetailError(getErrorMessage(err, 'Erro ao carregar detalhes da execução.'))
    } finally {
      setRunDetailLoading(false)
    }
  }, [])

  const loadRuns = useCallback(async () => {
    setRunsLoading(true)
    setRunsError(null)
    try {
      const result = await getAiTestRuns()
      setRuns(result.items)
      if (result.items.length > 0) {
        setSelectedRunId((prev) => prev ?? result.items[0].id)
      }
    } catch (err) {
      setRuns([])
      setRunsError(getErrorMessage(err, 'Erro ao carregar histórico de execuções.'))
    } finally {
      setRunsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCases(appliedCaseFilters)
  }, [appliedCaseFilters, loadCases])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (selectedRunId) void loadRunDetail(selectedRunId)
  }, [selectedRunId, loadRunDetail])

  const applyCaseFilters = () => setAppliedCaseFilters({ ...caseFilters })
  const resetCaseFilters = () => {
    setCaseFilters(emptyCaseFilters)
    setAppliedCaseFilters(emptyCaseFilters)
  }

  const selectRun = (runId: string) => {
    setSelectedRunId(runId)
    setActiveTab('resultado')
  }

  const handleRunCase = async (testCase: AiTestCase) => {
    setRunningCaseId(testCase.id)
    setFeedback(null)
    try {
      const result = await runAiTestCase({ caseId: testCase.id })
      setFeedback({ type: 'success', message: `Caso "${testCase.code}" executado com sucesso.` })
      await loadRuns()
      setSelectedRunId(result.run.id)
      await loadRunDetail(result.run.id)
      setActiveTab('resultado')
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao executar o caso.') })
    } finally {
      setRunningCaseId(null)
    }
  }

  const handleRunDataset = async () => {
    setRunningDataset(true)
    setFeedback(null)
    try {
      const result = await runAiTestDataset({
        groupName: caseFilters.groupName || undefined,
        includeMissingDocs,
      })
      setFeedback({ type: 'success', message: 'Execução do dataset concluída.' })
      await loadRuns()
      setSelectedRunId(result.run.id)
      await loadRunDetail(result.run.id)
      setActiveTab('resultado')
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao executar o dataset.') })
    } finally {
      setRunningDataset(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    if (!selectedRunId) return
    setExporting(format)
    setFeedback(null)
    try {
      await exportAiTestRun(selectedRunId, format)
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Falha ao exportar relatório.') })
    } finally {
      setExporting(null)
    }
  }

  const latestRun = runs[0] ?? null
  const summaryScore = runDetail?.metrics?.overallScore ?? latestRun?.overallScore ?? null
  const summaryAvgMs = runDetail?.metrics?.avgDurationMs ?? null

  const filteredResults = useMemo(() => {
    const items = runDetail?.results ?? []
    return items.filter((r) => {
      if (resultVerdictFilter && r.verdict !== resultVerdictFilter) return false
      if (resultSearch) {
        const needle = resultSearch.toLowerCase()
        const haystack = `${r.caseCode ?? ''} ${r.question}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [runDetail, resultVerdictFilter, resultSearch])

  const scoreBreakdownAvg = useMemo(() => {
    const items = (runDetail?.results ?? []).filter((r) => r.scoreBreakdown)
    if (items.length === 0) return null
    const totals = { answerQuality: 0, sources: 0, document: 0, latency: 0 }
    for (const r of items) {
      const b = r.scoreBreakdown!
      totals.answerQuality += b.answerQuality
      totals.sources += b.sources
      totals.document += b.document
      totals.latency += b.latency
    }
    const n = items.length
    return {
      answerQuality: totals.answerQuality / n,
      sources: totals.sources / n,
      document: totals.document / n,
      latency: totals.latency / n,
      weights: items[0].scoreBreakdown!.weights,
    }
  }, [runDetail])

  return (
    <div>
      <PageHeader
        title="Validação IA"
        description="Framework de avaliação automatizada da Consulta IA"
        actions={
          <>
            <label className="mr-1 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeMissingDocs}
                onChange={(e) => setIncludeMissingDocs(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Incluir docs ausentes
            </label>
            <Button onClick={() => void handleRunDataset()} disabled={runningDataset}>
              <PlayCircle size={16} />
              {runningDataset ? 'Executando…' : 'Executar Dataset'}
            </Button>
            {selectedRunId && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleExport('json')}
                  disabled={exporting !== null}
                >
                  <Download size={16} />
                  {exporting === 'json' ? 'Exportando…' : 'Exportar JSON'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleExport('csv')}
                  disabled={exporting !== null}
                >
                  <Download size={16} />
                  {exporting === 'csv' ? 'Exportando…' : 'Exportar CSV'}
                </Button>
              </>
            )}
          </>
        }
      />

      {feedback && (
        <p
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="!p-0">
          <div className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <FlaskConical size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total de casos</p>
              <p className="text-2xl font-bold text-slate-800">
                {casesLoading ? '—' : cases.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-sm text-slate-500">Último score</p>
            <p className="text-2xl font-bold text-slate-800">
              {summaryScore != null ? summaryScore : '—'}
            </p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-sm text-slate-500">Status da última execução</p>
            {latestRun ? (
              <span
                className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusTone(latestRun.status)}`}
              >
                {latestRun.status}
              </span>
            ) : (
              <p className="text-2xl font-bold text-slate-800">—</p>
            )}
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-sm text-slate-500">Tempo médio</p>
            <p className="text-2xl font-bold text-slate-800">{formatMs(summaryAvgMs)}</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {(
          [
            { key: 'casos', label: 'Casos' },
            { key: 'historico', label: 'Histórico' },
            { key: 'resultado', label: 'Resultado' },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-[var(--color-primary,#0d4f8b)] text-[var(--color-primary,#0d4f8b)]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'casos' && (
        <div className="mt-4">
          <Card className="mb-4 !p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Grupo"
                placeholder="Ex.: FINANCEIRO"
                value={caseFilters.groupName ?? ''}
                onChange={(e) => setCaseFilters((f) => ({ ...f, groupName: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyCaseFilters()}
              />
              <Input
                label="Tipo de teste"
                placeholder="Ex.: DOCUMENT_LOOKUP"
                value={caseFilters.testType ?? ''}
                onChange={(e) => setCaseFilters((f) => ({ ...f, testType: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyCaseFilters()}
              />
              <Select
                label="Status"
                value={caseFilters.status ?? ''}
                onChange={(e) => setCaseFilters((f) => ({ ...f, status: e.target.value }))}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'active', label: 'Ativo' },
                  { value: 'inactive', label: 'Inativo' },
                ]}
              />
              <div className="flex items-end gap-2">
                <Button variant="primary" onClick={applyCaseFilters} disabled={casesLoading}>
                  Filtrar
                </Button>
                <Button variant="outline" onClick={resetCaseFilters} disabled={casesLoading}>
                  Limpar
                </Button>
              </div>
            </div>
          </Card>

          {casesError && (
            <Card className="mb-4 border-red-200 bg-red-50 !p-4 text-sm text-red-700">
              {casesError}
            </Card>
          )}

          <Card className="overflow-x-auto !p-0">
            {casesLoading ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                Carregando casos…
              </div>
            ) : cases.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="Nenhum caso encontrado"
                description="Ajuste os filtros ou cadastre casos de teste no banco de dados."
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Grupo</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Score mín.</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3">{c.groupName}</td>
                      <td className="px-4 py-3">{c.testType}</td>
                      <td className="px-4 py-3">{c.minScore}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.status === 'active' ? 'success' : 'default'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          className="!px-2 !py-1 text-xs"
                          onClick={() => void handleRunCase(c)}
                          disabled={runningCaseId !== null}
                        >
                          {runningCaseId === c.id ? 'Executando…' : 'Executar Caso'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="mt-4">
          {runsError && (
            <Card className="mb-4 border-red-200 bg-red-50 !p-4 text-sm text-red-700">
              {runsError}
            </Card>
          )}
          <Card className="overflow-x-auto !p-0">
            {runsLoading ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                Carregando execuções…
              </div>
            ) : runs.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="Nenhuma execução registrada"
                description="Execute o dataset ou um caso individual para ver o histórico aqui."
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Início</th>
                    <th className="px-4 py-3 font-medium">Modo</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Casos</th>
                    <th className="px-4 py-3 font-medium">Aprovados</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Duração</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selectedRunId === run.id ? 'bg-slate-50' : ''
                      }`}
                      onClick={() => selectRun(run.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3">{formatWhen(run.startedAt)}</td>
                      <td className="px-4 py-3">{run.triggerMode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusTone(run.status)}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{run.totalCases}</td>
                      <td className="px-4 py-3">
                        {run.passedCount}/{run.totalCases}
                      </td>
                      <td className="px-4 py-3">{run.overallScore ?? '—'}</td>
                      <td className="px-4 py-3">{formatMs(run.durationMs)}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          className="!px-2 !py-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            selectRun(run.id)
                          }}
                        >
                          Ver detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'resultado' && (
        <div className="mt-4">
          {!selectedRunId ? (
            <Card>
              <EmptyState
                icon={FlaskConical}
                title="Nenhuma execução selecionada"
                description="Selecione uma execução no Histórico ou execute o dataset."
              />
            </Card>
          ) : runDetailLoading && !runDetail ? (
            <Card>
              <p className="text-sm text-slate-500">Carregando detalhes da execução…</p>
            </Card>
          ) : runDetailError ? (
            <Card className="border-red-200 bg-red-50 text-sm text-red-700">
              {runDetailError}
            </Card>
          ) : runDetail ? (
            <>
              <Card title="Métricas da execução" className="mb-4">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <p className="text-xs text-slate-500">Precisão</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {runDetail.metrics?.precision ?? '—'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Recall</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {runDetail.metrics?.recall ?? '—'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Cobertura de docs.</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {runDetail.metrics?.documentCoverage ?? '—'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Duração média</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatMs(runDetail.metrics?.avgDurationMs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Min / Máx</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatMs(runDetail.metrics?.minDurationMs)} /{' '}
                      {formatMs(runDetail.metrics?.maxDurationMs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Alucinações</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {runDetail.metrics?.hallucinationCount ?? 0}
                    </p>
                  </div>
                </div>

                {scoreBreakdownAvg && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <ScoreBar
                      label="Qualidade da resposta"
                      value={scoreBreakdownAvg.answerQuality}
                      max={scoreBreakdownAvg.weights.answerQuality}
                    />
                    <ScoreBar
                      label="Fontes"
                      value={scoreBreakdownAvg.sources}
                      max={scoreBreakdownAvg.weights.sources}
                    />
                    <ScoreBar
                      label="Documento esperado"
                      value={scoreBreakdownAvg.document}
                      max={scoreBreakdownAvg.weights.document}
                    />
                    <ScoreBar
                      label="Latência"
                      value={scoreBreakdownAvg.latency}
                      max={scoreBreakdownAvg.weights.latency}
                    />
                  </div>
                )}
              </Card>

              <Card className="mb-4 !p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Veredito"
                    value={resultVerdictFilter}
                    onChange={(e) => setResultVerdictFilter(e.target.value)}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'PASS', label: 'PASS' },
                      { value: 'FAIL', label: 'FAIL' },
                      { value: 'ERROR', label: 'ERROR' },
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Busca"
                      placeholder="Código do caso ou pergunta…"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              <Card className="overflow-x-auto !p-0">
                {filteredResults.length === 0 ? (
                  <EmptyState
                    icon={FlaskConical}
                    title="Nenhum resultado encontrado"
                    description="Ajuste os filtros para ver os resultados desta execução."
                  />
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Caso</th>
                        <th className="px-4 py-3 font-medium">Pergunta</th>
                        <th className="px-4 py-3 font-medium">Veredito</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Duração</th>
                        <th className="px-4 py-3 font-medium">Alucinação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs">{r.caseCode ?? '—'}</td>
                          <td className="max-w-md truncate px-4 py-3" title={r.question}>
                            {r.question}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={verdictBadgeVariant(r.verdict)}>{r.verdict}</Badge>
                          </td>
                          <td className="px-4 py-3">{r.score ?? '—'}</td>
                          <td className="px-4 py-3">{formatMs(r.durationMs)}</td>
                          <td className="px-4 py-3">
                            {r.isHallucination ? (
                              <Badge variant="danger">Sim</Badge>
                            ) : (
                              <span className="text-slate-400">Não</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
