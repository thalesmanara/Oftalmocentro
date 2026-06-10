import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getDocumentById, updateDocument, uploadDocumentFile } from '@/services/documentsService'
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
  const [feedback, setFeedback] = useState<Feedback | null>(null)

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
        setUploading(true)
        try {
          await uploadDocumentFile(id, data.file)
        } catch {
          setDoc(updated)
          setFeedback({
            type: 'error',
            message:
              'Dados salvos, mas não foi possível enviar o arquivo. Selecione o arquivo novamente e tente outra vez.',
          })
          return
        } finally {
          setUploading(false)
        }
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
          submitLabel={
            uploading ? 'Enviando arquivo...' : saving ? 'Salvando...' : 'Salvar alterações'
          }
          submitting={saving || uploading}
        />
      </Card>
    </div>
  )
}
