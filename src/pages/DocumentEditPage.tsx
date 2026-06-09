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
    await updateDocument(id, data, user.id, user.name)
    logAction(user.name, 'Edição', 'Documento', `Documento "${data.title}" editado`)
    navigate(`/documentos/${id}`)
  }

  if (!doc) return <p className="text-slate-500">Carregando...</p>

  return (
    <div>
      <PageHeader title="Editar documento" description={doc.title} />
      <Card>
        <DocumentForm
          initial={{
            title: doc.title,
            sectorId: doc.sectorId,
            categoryId: doc.categoryId,
            semanticDescription: doc.semanticDescription,
            tagIds: doc.tagIds,
            expirationDate: doc.expirationDate ?? '',
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/documentos/${id}`)}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  )
}
