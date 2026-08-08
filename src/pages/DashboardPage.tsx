import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, Upload, Bot, Loader2, CalendarClock } from 'lucide-react'
import { getDocuments } from '@/services/documentsService'
import { getCategories } from '@/services/categoriesService'
import { getSectors } from '@/services/sectorsService'
import type { Category, Document, Sector } from '@/types'
import { getCategoryNameById, getSectorNameById } from '@/utils/entities'
import {
  daysUntilExpiration,
  formatDate,
  formatDateTime,
  getDocumentVigencyBadge,
  isDocumentExpired,
  isDocumentExpiringSoon,
} from '@/utils/document'
import { getErrorMessage } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const VIGENCY_LIST_LIMIT = 8
const EXPIRING_WITHIN_DAYS = 60

type Stats = {
  totalDocs: number | null
  activeDocs: number | null
  processing: number | null
  failed: number | null
  expired: number | null
  categories: number | null
}

function isProcessing(doc: Document): boolean {
  const p = String(doc.processingStatus || '').toUpperCase()
  const e = String(doc.embeddingStatus || '').toUpperCase()
  return p === 'PROCESSING' || e === 'PROCESSING' || e === 'PENDING'
}

function isFailed(doc: Document): boolean {
  const p = String(doc.processingStatus || '').toUpperCase()
  const e = String(doc.embeddingStatus || '').toUpperCase()
  const q = String((doc as Document & { qdrantSyncStatus?: string }).qdrantSyncStatus || '').toUpperCase()
  return (
    p === 'FAILED' ||
    e === 'FAILED' ||
    q === 'FAILED' ||
    q === 'QDRANT_SYNC_FAILED' ||
    String(doc.ocrStatus || '').toUpperCase() === 'FAILED'
  )
}

export function DashboardPage() {
  const { hasPermission } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [partialWarnings, setPartialWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalDocs: null,
    activeDocs: null,
    processing: null,
    failed: null,
    expired: null,
    categories: null,
  })

  const canViewDocs = hasPermission('visualizar_documentos')
  const canUpload = hasPermission('cadastrar_documentos')
  const canAsk = hasPermission('usar_consulta_ia')

  const load = () => {
    setLoading(true)
    setError(null)
    setPartialWarnings([])

    const tasks: Array<Promise<unknown>> = []
    const labels: string[] = []

    if (canViewDocs) {
      tasks.push(getDocuments())
      labels.push('documentos')
      tasks.push(getSectors())
      labels.push('setores')
    }
    tasks.push(getCategories().catch(() => []))
    labels.push('categorias')

    void Promise.allSettled(tasks)
      .then((results) => {
        const warnings: string[] = []
        let docs: Document[] = []
        let sectorList: Sector[] = []
        let categoryList: Category[] = []

        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            warnings.push(`Não foi possível carregar ${labels[i]}.`)
            return
          }
          if (labels[i] === 'documentos') docs = r.value as Document[]
          if (labels[i] === 'setores') sectorList = r.value as Sector[]
          if (labels[i] === 'categorias') categoryList = r.value as Category[]
        })

        if (canViewDocs && results[0]?.status === 'rejected') {
          setError(getErrorMessage((results[0] as PromiseRejectedResult).reason, 'Não foi possível carregar o dashboard.'))
          setDocuments([])
          setStats({
            totalDocs: null,
            activeDocs: null,
            processing: null,
            failed: null,
            expired: null,
            categories: null,
          })
          return
        }

        setDocuments(docs)
        setSectors(sectorList)
        setCategories(categoryList)
        setPartialWarnings(warnings)
        setStats({
          totalDocs: canViewDocs ? docs.length : null,
          activeDocs: canViewDocs ? docs.filter((d) => d.isActive !== false).length : null,
          processing: canViewDocs ? docs.filter(isProcessing).length : null,
          failed: canViewDocs ? docs.filter(isFailed).length : null,
          expired: canViewDocs ? docs.filter(isDocumentExpired).length : null,
          categories: categoryList.length,
        })
      })
      .catch((err) => {
        setError(getErrorMessage(err, 'Não foi possível carregar o dashboard.'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewDocs])

  const recentDocuments = useMemo(
    () =>
      [...documents]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [documents]
  )

  const expiredDocuments = useMemo(
    () =>
      documents
        .filter(isDocumentExpired)
        .sort((a, b) => (daysUntilExpiration(a) ?? 0) - (daysUntilExpiration(b) ?? 0)),
    [documents]
  )

  const expiringDocuments = useMemo(
    () =>
      documents
        .filter((d) => isDocumentExpiringSoon(d, EXPIRING_WITHIN_DAYS))
        .sort((a, b) => (daysUntilExpiration(a) ?? 0) - (daysUntilExpiration(b) ?? 0)),
    [documents]
  )

  const cards = [
    { label: 'Total de documentos', value: stats.totalDocs, icon: FileText, color: 'bg-blue-50 text-blue-700' },
    {
      label: 'Documentos ativos',
      value: stats.activeDocs,
      icon: FileText,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Em processamento',
      value: stats.processing,
      icon: Loader2,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Com falha',
      value: stats.failed,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-700',
    },
    {
      label: 'Vigência expirada',
      value: stats.expired,
      icon: AlertTriangle,
      color: 'bg-orange-50 text-orange-700',
    },
  ]

  if (loading) {
    return (
      <p className="text-slate-500" role="status" aria-live="polite">
        Carregando dashboard...
      </p>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Visão operacional da clínica" />
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
          <Button className="mt-4" variant="secondary" onClick={load}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão operacional da clínica" />

      {partialWarnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {partialWarnings.join(' ')}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {canUpload && (
          <Link to="/documentos/novo">
            <Button>
              <Upload className="h-4 w-4" aria-hidden /> Enviar documento
            </Button>
          </Link>
        )}
        {canAsk && (
          <Link to="/consulta-ia">
            <Button variant="secondary">
              <Bot className="h-4 w-4" aria-hidden /> Consultar IA
            </Button>
          </Link>
        )}
      </div>

      {canViewDocs ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.label} className="!p-0">
              <div className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${card.color}`}>
                  <card.icon size={24} aria-hidden />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {card.value == null ? '—' : card.value}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-600">
            Seu perfil não inclui visualização de documentos. Use os atalhos disponíveis ou solicite
            permissão ao administrador.
          </p>
        </Card>
      )}

      {canViewDocs && (expiredDocuments.length > 0 || expiringDocuments.length > 0) && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CalendarClock size={18} className="mt-0.5 flex-shrink-0" aria-hidden />
          <p>
            {expiredDocuments.length} documento{expiredDocuments.length === 1 ? '' : 's'}{' '}
            {expiredDocuments.length === 1 ? 'está expirado' : 'estão expirados'} e{' '}
            {expiringDocuments.length} vence{expiringDocuments.length === 1 ? '' : 'm'} nos próximos{' '}
            {EXPIRING_WITHIN_DAYS} dias.
          </p>
        </div>
      )}

      {canViewDocs && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Vigência de Documentos</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Documentos expirados"
              subtitle={`${expiredDocuments.length} documento${expiredDocuments.length === 1 ? '' : 's'} vencido${
                expiredDocuments.length === 1 ? '' : 's'
              }`}
            >
              {expiredDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum documento expirado.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {expiredDocuments.slice(0, VIGENCY_LIST_LIMIT).map((doc) => {
                    const badge = getDocumentVigencyBadge(doc)
                    return (
                      <li key={doc.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <Link
                            to={`/documentos/${doc.id}`}
                            className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
                          >
                            {doc.title}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)} ·{' '}
                            {doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)} ·{' '}
                            {formatDate(doc.expirationDate)}
                          </p>
                        </div>
                        <Badge variant="danger" className="flex-shrink-0">
                          {badge.days} dia{badge.days === 1 ? '' : 's'} vencido
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
              {expiredDocuments.length > VIGENCY_LIST_LIMIT && (
                <div className="mt-3 text-right">
                  <Link to="/documentos" className="text-sm font-medium text-[var(--color-primary,#0d4f8b)] hover:underline">
                    Ver todos
                  </Link>
                </div>
              )}
            </Card>

            <Card
              title="Documentos que expiram nos próximos 60 dias"
              subtitle={`${expiringDocuments.length} documento${expiringDocuments.length === 1 ? '' : 's'} próximo${
                expiringDocuments.length === 1 ? '' : 's'
              } do vencimento`}
            >
              {expiringDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum documento próximo do vencimento.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {expiringDocuments.slice(0, VIGENCY_LIST_LIMIT).map((doc) => {
                    const badge = getDocumentVigencyBadge(doc)
                    return (
                      <li key={doc.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <Link
                            to={`/documentos/${doc.id}`}
                            className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
                          >
                            {doc.title}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)} ·{' '}
                            {doc.categoryName ?? getCategoryNameById(doc.categoryId, categories)} ·{' '}
                            {formatDate(doc.expirationDate)}
                          </p>
                        </div>
                        <Badge variant="warning" className="flex-shrink-0">
                          {badge.days === 0 ? 'Vence hoje' : `${badge.days} dia${badge.days === 1 ? '' : 's'}`}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
              {expiringDocuments.length > VIGENCY_LIST_LIMIT && (
                <div className="mt-3 text-right">
                  <Link to="/documentos" className="text-sm font-medium text-[var(--color-primary,#0d4f8b)] hover:underline">
                    Ver todos
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {canViewDocs && (
        <div className="mt-6">
          <Card title="Últimos documentos">
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum documento cadastrado ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Link
                        to={`/documentos/${doc.id}`}
                        className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline"
                      >
                        {doc.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)} ·{' '}
                        {formatDateTime(doc.createdAt)}
                      </p>
                    </div>
                    {isDocumentExpired(doc) && <Badge variant="danger">Vigência expirada</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
