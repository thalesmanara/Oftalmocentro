import { Bot } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export function ConsultaIAPage() {
  return (
    <div>
      <PageHeader
        title="Consulta IA"
        description="Módulo de inteligência artificial — em desenvolvimento"
      />
      <Card>
        <div className="flex flex-col items-center py-16 text-center">
          <Bot className="mb-6 h-16 w-16 text-slate-300" />
          <p className="max-w-xl text-lg text-slate-700">
            A consulta com IA será implementada na próxima etapa. Este módulo utilizará os documentos
            cadastrados como base oficial de conhecimento da clínica.
          </p>
        </div>
      </Card>
    </div>
  )
}
