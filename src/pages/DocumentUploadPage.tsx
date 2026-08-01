import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createDocument, processDocument, uploadDocumentFile } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { DocumentFormData } from '@/types'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DocumentForm } from '@/components/documents/DocumentForm'
import { getErrorMessage } from '@/utils/apiError'

type Feedback = { type: 'success' | 'error'; message: string }

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const isBusy = saving || uploading || processing

  const submitLabel = processing
    ? 'Processando documento...'
    : uploading
      ? 'Enviando arquivo...'
      : saving
        ? 'Salvando...'
        : 'Salvar'

  const handleSubmit = async (data: DocumentFormData) => {
    if (!user) return

    if (!data.title.trim() || !data.sectorId || !data.categoryId || !data.semanticDescription.trim()) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' })
      return
    }

    setSaving(true)
    setUploading(false)
    setProcessing(false)
    setFeedback(null)

    let documentId: string | null = null
    let postCreateError: string | null = null

    try {
      const createdDocument = await createDocument(data, user.id, user.name)
      console.log('Documento criado:', createdDocument)

      if (!createdDocument?.id) {
        throw new Error('Documento criado, mas o ID não foi retornado')
      }

      documentId = createdDocument.id

      if (data.file) {
        setSaving(false)
        setUploading(true)

        try {
          await uploadDocumentFile(createdDocument.id, data.file)
        } catch (err) {
          postCreateError = getErrorMessage(
            err,
            'Documento criado, mas houve erro ao enviar o arquivo.'
          )
        } finally {
          setUploading(false)
        }

        if (!postCreateError) {
          setProcessing(true)

          try {
            await processDocument(createdDocument.id)
          } catch (err) {
            postCreateError = getErrorMessage(
              err,
              'Documento criado e arquivo enviado, mas houve erro no processamento.'
            )
          } finally {
            setProcessing(false)
          }
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err, 'Erro ao criar documento.') })
      setSaving(false)
      setUploading(false)
      setProcessing(false)
      return
    }

    if (!documentId) {
      setFeedback({ type: 'error', message: 'Erro ao criar documento.' })
      setSaving(false)
      return
    }

    console.log('ID para navegação:', documentId)
    console.log('Navegando para:', `/documentos/${documentId}`)

    logAction(user.name, 'Cadastro', 'Documento', `Documento "${data.title.trim()}" cadastrado`)

    navigate(`/documentos/${documentId}`, {
      replace: true,
      state: postCreateError ? { errorMessage: postCreateError } : undefined,
    })
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

      {processing && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={18} className="animate-spin text-[var(--color-primary,#0d4f8b)]" />
          Processando documento e preparando base de conhecimento...
        </div>
      )}

      <Card>
        <DocumentForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/documentos')}
          submitLabel={submitLabel}
          submitting={isBusy}
        />
      </Card>
    </div>
  )
}
