import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, Users, FolderOpen, TrendingUp } from 'lucide-react'
import { getDocuments } from '@/services/documentsService'
import { getUsers } from '@/services/usersService'
import { getCategories } from '@/services/categoriesService'
import { getSectors } from '@/services/sectorsService'
import type { Document, Sector } from '@/types'
import { getSectorNameById } from '@/utils/entities'
import { isDocumentExpired, formatDateTime } from '@/utils/document'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'

export function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDocs: 0,
    expired: 0,
    activeUsers: 0,
    categories: 0,
  })

  useEffect(() => {
    setLoading(true)
    void Promise.all([getDocuments(), getUsers(), getCategories(), getSectors()])
      .then(([docs, users, categories, sectors]) => {
        const recent = [...docs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setDocuments(recent.slice(0, 5))
        setSectors(sectors)
        setStats({
          totalDocs: docs.length,
          expired: docs.filter(isDocumentExpired).length,
          activeUsers: users.filter((u) => u.active).length,
          categories: categories.length,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Total de documentos', value: stats.totalDocs, icon: FileText, color: 'bg-blue-50 text-blue-700' },
    { label: 'Documentos vencidos', value: stats.expired, icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
    { label: 'Usuários ativos', value: stats.activeUsers, icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Categorias cadastradas', value: stats.categories, icon: FolderOpen, color: 'bg-violet-50 text-violet-700' },
  ]

  const chartData = [12, 19, 8, 22, 15, 28, 18]

  if (loading) {
    return <p className="text-slate-500">Carregando dashboard...</p>
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
                <p className="text-2xl font-bold text-slate-800">{card.value}</p>
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
                <li key={doc.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <Link to={`/documentos/${doc.id}`} className="font-medium text-[var(--color-primary,#0d4f8b)] hover:underline">
                      {doc.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {doc.sectorName ?? getSectorNameById(doc.sectorId, sectors)} · {formatDateTime(doc.createdAt)}
                    </p>
                  </div>
                  {isDocumentExpired(doc) && <Badge variant="danger">Vencido</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Atividade documental (mock)">
          <div className="flex h-48 items-end justify-between gap-2 px-2">
            {chartData.map((value, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${(value / 28) * 100}%`,
                    minHeight: 8,
                    backgroundColor: 'var(--color-secondary, #1a8fbf)',
                  }}
                />
                <span className="text-[10px] text-slate-400">
                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <TrendingUp size={14} />
            Gráfico ilustrativo — dados reais após integração com n8n
          </div>
        </Card>
      </div>
    </div>
  )
}
