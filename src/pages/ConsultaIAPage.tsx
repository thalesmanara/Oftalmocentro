import { useMemo, useState } from 'react'
import { Bot, Loader2, Printer } from 'lucide-react'
import { askAI, type AIResponse, type AISource } from '@/services/aiService'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { SimpleMarkdown } from '@/components/ai/SimpleMarkdown'

function getUniqueSources(sources: AISource[]) {
  return Array.from(new Map(sources.map((source) => [source.documentId, source])).values())
}

export function ConsultaIAPage() {
  const { settings } = useSettings()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<AIResponse | null>(null)

  const uniqueSources = useMemo(
    () => (response ? getUniqueSources(response.sources) : []),
    [response]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed = question.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await askAI(trimmed)
      setResponse(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar a IA no momento. Tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="consulta-ia-page">
      <div className="no-print">
        <PageHeader
          title="Consulta IA"
          description="Faça perguntas com base nos documentos cadastrados na base oficial da clínica."
        />

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              label="Sua pergunta"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ex.: Qual é o protocolo de triagem oftalmológica?"
              rows={4}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Consultando...
                </>
              ) : (
                'Perguntar'
              )}
            </Button>
          </form>
        </Card>

        {loading && (
          <Card className="mb-6">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 size={20} className="animate-spin text-[var(--color-primary,#0d4f8b)]" />
              Consultando a base de conhecimento...
            </div>
          </Card>
        )}

        {error && !loading && (
          <Card className="mb-6 border-red-100 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {!loading && !error && !response && (
          <Card>
            <div className="flex flex-col items-center py-12 text-center">
              <Bot className="mb-4 h-12 w-12 text-slate-300" />
              <p className="max-w-xl text-sm text-slate-500">
                Digite uma pergunta acima para consultar a IA com base nos documentos oficiais da
                clínica.
              </p>
            </div>
          </Card>
        )}
      </div>

      {response && !loading && (
        <div id="ai-print-area" className="space-y-6">
          <div className="hidden print:block print-header">
            <h1 className="text-xl font-bold text-slate-900">{settings.clinicName}</h1>
            <p className="text-sm text-slate-600">{settings.systemName}</p>
            <p className="mt-2 text-sm text-slate-500">
              Impresso em {new Date().toLocaleString('pt-BR')}
            </p>
          </div>

          <Card title="Pergunta" className="print-section">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{question.trim()}</p>
          </Card>

          <Card title="Resposta" className="print-section">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <SimpleMarkdown content={response.answer} />
            </div>
          </Card>

          <Card title="Fontes consultadas" className="print-section">
            {uniqueSources.length > 0 ? (
              <ul className="space-y-3">
                {uniqueSources.map((source) => (
                  <li
                    key={source.documentId}
                    className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700"
                  >
                    <p>
                      <span className="font-medium text-slate-900">Documento:</span>{' '}
                      {source.documentTitle || '—'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Setor:</span>{' '}
                      {source.sectorName || '—'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Categoria:</span>{' '}
                      {source.categoryName || '—'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                A IA respondeu, mas nenhuma fonte foi retornada para esta consulta.
              </p>
            )}
          </Card>

          <div className="no-print">
            <Button variant="outline" onClick={handlePrint}>
              <Printer size={16} />
              Imprimir resposta
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
