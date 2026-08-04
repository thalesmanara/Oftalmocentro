import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, Users, FolderOpen } from 'lucide-react'
import { getDocuments } from '@/services/documentsService'
import { getUsers } from '@/services/usersService'
import { getCategories } from '@/services/categoriesService'
import { getSectors } from '@/services/sectorsService'
import type { Document, Sector } from '@/types'
import { getSectorNameById } from '@/utils/entities'
import { isDocumentExpired, formatDateTime } from '@/utils/document'
import { getErrorMessage } from '@/utils/apiError'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type Stats = {
  totalDocs: number | null
  expired: number | null
  activeUsers: number | null
  categories: number | null
}

export function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalDocs: null,
    expired: null,
    activeUsers: null,
    categories: null,
  })

  const load = () => {
    setLoading(true)
    setError(null)
    void Promise.allSettled([getDocuments(), getUsers(), getCategories(), getSectors()])
      .then(([docsResult, usersResult, categoriesResult, sectorsResult]) => {
        const docs = docsResult.status === 'fulfilled' ? docsResult.value : []
        const users = usersResult.status === 'fulfilled' ? usersResult.value : []
        const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
        const sectorList = sectorsResult.status === 'fulfilled' ? sectorsResult.value : []

        const hardFailures = [docsResult, categoriesResult, sectorsResult].filter(
          (r) => r.status === 'rejected',
        )
        if (hardFailures.length > 0) {
          const first = hardFailures[0] as PromiseRejectedResult
          throw first.reason
        }

        const recent = [...docs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setDocuments(recent.slice(0, 5))
        setSectors(sectorList)
        setStats({
          totalDocs: docs.length,
          expired: docs.filter(isDocumentExpired).length,
          activeUsers: usersResult.status === 'fulfilled' ? users.filter((u) => u.active).length : null,
          categories: categories.length,
        })
      })
      .catch((err) => {
        setDocuments([])
        setSectors([])
        setStats({
          totalDocs: null,
          expired: null,
          activeUsers: null,
          categories: null,
        })
        setError(getErrorMessage(err, 'Não foi possível carregar o dashboard.'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const cards = [
    {
      label: 'Total de documentos',
      value: stats.totalDocs,
      icon: FileText,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Documentos vencidos',
      value: stats.expired,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-700',
    },
    {
      label: 'Usuários ativos',
      value: stats.activeUsers,
      icon: Users,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Categorias cadastradas',
      value: stats.categories,
      icon: FolderOpen,
      color: 'bg-violet-50 text-violet-700',
    },
  ]

  if (loading) {
    return <p className="text-slate-500">Carregando dashboard...</p>
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Visão geral do sistema de gestão documental" />
        <Card>
          <p className="text-sm text-red-600">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={load}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do sistema de gestão documental" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="!p-0">
            <div className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${card.color}`}>
                <card.icon size={24} />
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Últimos documentos enviados">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum documento cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
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

        <Card title="Atividade documental">
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm font-medium text-slate-700">Indicador ainda não disponível</p>
            <p className="text-xs text-slate-500">
              Este gráfico será exibido quando houver métricas reais de atividade.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
