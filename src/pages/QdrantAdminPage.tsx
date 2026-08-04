import { useCallback, useEffect, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TechnicalAreaBanner } from '@/components/ui/TechnicalAreaBanner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { getErrorMessage } from '@/utils/apiError'
import {
  getQdrantAdminSnapshot,
  reindexQdrant,
  type QdrantReindexScope,
} from '@/services/qdrantService'
import type { HealthComponent } from '@/types'

function formatWhen(value?: string | null): string {
  if (!value) return '—'
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toLocaleString('pt-BR')
}

function statusBadge(status?: string) {
  const s = (status || 'unknown').toLowerCase()
  const variant =
    s === 'ok' ? 'success' : s === 'degraded' ? 'warning' : s === 'down' ? 'danger' : 'default'
  return <Badge variant={variant}>{status || '—'}</Badge>
}

export function QdrantAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qdrant, setQdrant] = useState<HealthComponent | undefined>()
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [scope, setScope] = useState<QdrantReindexScope>('document')
  const [documentId, setDocumentId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [chunkId, setChunkId] = useState('')
  const [reindexing, setReindexing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getQdrantAdminSnapshot()
      setQdrant(snap.qdrant)
      setCheckedAt(snap.health.checkedAt)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar o status do Qdrant.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleReindex() {
    setReindexing(true)
    setFeedback(null)
    setError(null)
    try {
      await reindexQdrant({
        scope,
        documentId: documentId.trim() || undefined,
        versionId: versionId.trim() || undefined,
        chunkId: chunkId.trim() || undefined,
      })
      setFeedback('Reindexação solicitada com sucesso.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao solicitar reindexação.'))
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="space-y-6">
      <TechnicalAreaBanner />
      <PageHeader
        title="Qdrant"
        description="Status do banco vetorial, sincronização de embeddings e reindexação administrativa."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} />
            Atualizar
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50 !p-4 text-sm text-red-700">{error}</Card>
      )}
      {feedback && (
        <Card className="border-emerald-200 bg-emerald-50 !p-4 text-sm text-emerald-800">
          {feedback}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Status" className="!p-4">
          {loading && !qdrant ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Saúde</dt>
                <dd>{statusBadge(qdrant?.status)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Online</dt>
                <dd>{qdrant?.online == null ? '—' : qdrant.online ? 'Sim' : 'Não'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Coleção</dt>
                <dd className="font-mono text-xs">{qdrant?.collection || 'oftalmocentro_chunks'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Pontos</dt>
                <dd>{qdrant?.total ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Verificado em</dt>
                <dd>{formatWhen(checkedAt)}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card title="Sincronização" className="!p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Pendentes</dt>
              <dd>{qdrant?.pending ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Falhas</dt>
              <dd>{qdrant?.failures ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Tempo médio</dt>
              <dd>
                {qdrant?.avgDurationMs != null ? `${qdrant.avgDurationMs} ms` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Última sync</dt>
              <dd>{formatWhen(qdrant?.lastRunAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Modelo</dt>
              <dd className="text-xs">{qdrant?.model || 'text-embedding-3-small'}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Segurança" className="!p-4">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <Database className="mt-0.5 shrink-0 text-slate-400" size={18} />
            <p>
              O Qdrant permanece apenas na rede interna Docker. O frontend nunca consulta o
              banco vetorial diretamente — somente o n8n.
            </p>
          </div>
        </Card>
      </div>

      <Card title="Reindexação" subtitle="Regenera pontos apenas dos chunks afetados (nunca a coleção inteira sem necessidade).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Escopo</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as QdrantReindexScope)}
            >
              <option value="document">Documento</option>
              <option value="version">Versão</option>
              <option value="chunk">Chunk</option>
              <option value="all">Tudo (pendentes)</option>
            </select>
          </label>
          <Input
            label="Document ID"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="uuid"
            disabled={scope === 'all' || scope === 'chunk'}
          />
          <Input
            label="Version ID"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            placeholder="uuid"
            disabled={scope !== 'version'}
          />
          <Input
            label="Chunk ID"
            value={chunkId}
            onChange={(e) => setChunkId(e.target.value)}
            placeholder="uuid"
            disabled={scope !== 'chunk'}
          />
        </div>
        <div className="mt-4">
          <Button onClick={() => void handleReindex()} disabled={reindexing}>
            {reindexing ? 'Reindexando…' : 'Reindexar'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
