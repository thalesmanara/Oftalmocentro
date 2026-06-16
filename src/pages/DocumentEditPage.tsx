import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getDocumentById, processDocument, updateDocument, uploadDocumentFile } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { Document, DocumentFormData } from '@/types'
import { getDocumentTagIds } from '@/utils/document'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DocumentForm } from '@/components/documents/DocumentForm'

type Feedback = { type: 'success' | 'error'; message: string }

export function DocumentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
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
        : 'Salvar alterações'

  useEffect(() => {
    if (!id) return

    setLoading(true)
    void getDocumentById(id)
      .then(setDoc)
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: DocumentFormData) => {
    if (!user || !id || !doc) return

    if (!data.title.trim() || !data.sectorId || !data.categoryId || !data.semanticDescription.trim() || !data.expirationDate) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const updated = await updateDocument(id, data, user.id, user.name, doc)

      if (data.file) {
        setSaving(false)
        setUploading(true)

        try {
          await uploadDocumentFile(id, data.file)
        } catch {
          setDoc(updated)
          setFeedback({ type: 'error', message: 'Falha ao enviar arquivo.' })
          return
        } finally {
          setUploading(false)
        }

        setProcessing(true)

        try {
          await processDocument(id)
          const refreshed = await getDocumentById(id)
          if (refreshed) setDoc(refreshed)

          setFeedback({
            type: 'success',
            message: 'Documento enviado e processado com sucesso.',
          })
          logAction(user.name, 'Edição', 'Documento', `Documento "${data.title}" editado e processado`)

          window.setTimeout(() => {
            navigate(`/documentos/${id}`)
          }, 1500)
        } catch {
          setDoc(updated)
          setFeedback({
            type: 'error',
            message: 'Arquivo enviado, mas ocorreu erro no processamento.',
          })
        } finally {
          setProcessing(false)
        }

        return
      }

      const refreshed = await getDocumentById(id)
      if (refreshed) setDoc(refreshed)
      logAction(user.name, 'Edição', 'Documento', `Documento "${data.title}" editado`)
      navigate(`/documentos/${id}`)
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao atualizar documento.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando documento...</p>
  }

  if (!doc) {
    return (
      <div>
        <Link to="/documentos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Voltar à biblioteca
        </Link>
        <p className="text-slate-500">Documento não encontrado.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Editar documento" description={doc.title} />

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
          key={`${doc.id}-${getDocumentTagIds(doc).join(',')}`}
          initial={{
            title: doc.title,
            sectorId: doc.sectorId,
            categoryId: doc.categoryId,
            semanticDescription: doc.semanticDescription,
            expirationDate: doc.expirationDate ?? '',
          }}
          initialTagIds={getDocumentTagIds(doc)}
          initialDocumentTags={doc.tags}
          initialFile={{
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/documentos/${id}`)}
          submitLabel={submitLabel}
          submitting={isBusy}
        />
      </Card>
    </div>
  )
}
