import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { createDocument, uploadDocumentFile } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { DocumentFormData } from '@/types'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DocumentForm } from '@/components/documents/DocumentForm'

type Feedback = { type: 'success' | 'error'; message: string }

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleSubmit = async (data: DocumentFormData) => {
    if (!user) return

    if (!data.title.trim() || !data.sectorId || !data.categoryId || !data.semanticDescription.trim() || !data.expirationDate) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const doc = await createDocument(data, user.id, user.name)

      if (data.file) {
        setUploading(true)
        try {
          await uploadDocumentFile(doc.id, data.file)
        } catch {
          setFeedback({
            type: 'error',
            message:
              'Documento criado, mas não foi possível enviar o arquivo. Edite o documento para tentar novamente.',
          })
          navigate(`/documentos/${doc.id}/editar`)
          return
        } finally {
          setUploading(false)
        }
      }

      logAction(user.name, 'Cadastro', 'Documento', `Documento "${doc.title}" cadastrado`)
      navigate(`/documentos/${doc.id}`)
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao criar documento.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Novo documento"
        description="Cadastre um novo documento na biblioteca"
      />

      {feedback && (
        <p
          className={`mb-4 text-sm ${
            feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Card>
        <DocumentForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/documentos')}
          submitLabel={uploading ? 'Enviando arquivo...' : saving ? 'Salvando...' : 'Salvar'}
          submitting={saving || uploading}
        />
      </Card>
    </div>
  )
}
