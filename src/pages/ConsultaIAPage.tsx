import { useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { askAI, type AIResponse } from '@/services/aiService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { SimpleMarkdown } from '@/components/ai/SimpleMarkdown'

export function ConsultaIAPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<AIResponse | null>(null)

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

  return (
    <div>
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

      {response && !loading && (
        <>
          <Card title="Resposta" className="mb-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <SimpleMarkdown content={response.answer} />
            </div>
          </Card>

          <Card title="Fontes consultadas">
            {response.sources.length > 0 ? (
              <ul className="space-y-3">
                {response.sources.map((source) => (
                  <li
                    key={`${source.documentId}-${source.index}-${source.chunkOrder ?? 0}`}
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
                    <p>
                      <span className="font-medium text-slate-900">Chunk:</span>{' '}
                      {source.chunkOrder ?? '—'}
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
        </>
      )}
    </div>
  )
}
