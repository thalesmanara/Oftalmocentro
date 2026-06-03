import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDocumentById, updateDocument } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { Document, DocumentFormData } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DocumentForm } from '@/components/documents/DocumentForm'

export function DocumentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doc, setDoc] = useState<Document | null>(null)

  useEffect(() => {
    if (id) void getDocumentById(id).then(setDoc)
  }, [id])

  const handleSubmit = async (data: DocumentFormData) => {
    if (!user || !id) return
    await updateDocument(id, data, user.id, user.nome)
    logAction(user.nome, 'Edição', 'Documento', `Documento "${data.titulo}" editado`)
    navigate(`/documentos/${id}`)
  }

  if (!doc) return <p className="text-slate-500">Carregando...</p>

  return (
    <div>
      <PageHeader title="Editar documento" description={doc.titulo} />
      <Card>
        <DocumentForm
          initial={{
            titulo: doc.titulo,
            setor: doc.setor,
            categoria: doc.categoria,
            descricaoSemantica: doc.descricaoSemantica,
            tags: doc.tags,
            dataValidade: doc.dataValidade ?? '',
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/documentos/${id}`)}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  )
}
