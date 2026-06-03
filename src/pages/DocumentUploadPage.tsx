import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { createDocument } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { DocumentFormData } from '@/types'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DocumentForm } from '@/components/documents/DocumentForm'

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubmit = async (data: DocumentFormData) => {
    if (!user) return
    const doc = await createDocument(data, user.id, user.nome)
    logAction(user.nome, 'Upload', 'Documento', `Documento "${doc.titulo}" enviado`)
    navigate(`/documentos/${doc.id}`)
  }

  return (
    <div>
      <PageHeader
        title="Upload de documento"
        description="Cadastre um novo documento na biblioteca"
      />
      <Card>
        <DocumentForm onSubmit={handleSubmit} onCancel={() => navigate('/documentos')} />
      </Card>
    </div>
  )
}
