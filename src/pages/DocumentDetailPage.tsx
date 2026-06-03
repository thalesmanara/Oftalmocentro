import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, FileIcon, ArrowLeft } from 'lucide-react'
import { getDocumentById, deleteDocument } from '@/services/documentsService'
import { logAction } from '@/services/auditService'
import type { Document } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatDateTime, formatFileSize, isDocumentExpired } from '@/utils/document'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/ui/PermissionGuard'
import { ModalConfirm } from '@/components/ui/Modal'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doc, setDoc] = useState<Document | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (id) void getDocumentById(id).then(setDoc)
  }, [id])

  if (!doc) {
    return <p className="text-slate-500">Carregando documento...</p>
  }

  const expired = isDocumentExpired(doc)

  const handleDelete = async () => {
    if (!user || !id) return
    await deleteDocument(id)
    logAction(user.nome, 'Exclusão', 'Documento', `Documento "${doc.titulo}" excluído`)
    navigate('/documentos')
  }

  return (
    <div>
      <Link
        to="/documentos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Voltar à biblioteca
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{doc.titulo}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="info">{doc.setor}</Badge>
            <Badge>{doc.categoria}</Badge>
            {expired ? <Badge variant="danger">Vencido</Badge> : <Badge variant="success">Válido</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard permission="editar_documentos">
            <Button variant="outline" onClick={() => navigate(`/documentos/${id}/editar`)}>
              <Pencil size={16} />
              Editar
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="excluir_documentos">
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              Excluir
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informações">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Descrição Semântica</dt>
              <dd className="mt-0.5 text-slate-800">{doc.descricaoSemantica}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {doc.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Data de validade</dt>
              <dd className="text-slate-800">{formatDate(doc.dataValidade)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="text-slate-800">{doc.usuarioResponsavel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Data de cadastro</dt>
              <dd className="text-slate-800">{formatDateTime(doc.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Última atualização</dt>
              <dd className="text-slate-800">{formatDateTime(doc.updatedAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Arquivo">
          <div className="flex items-start gap-4">
            <FileIcon className="text-slate-400" size={40} />
            <div>
              <p className="font-medium text-slate-800">{doc.nomeArquivo}</p>
              <p className="text-sm text-slate-500">{formatFileSize(doc.tamanhoArquivo)}</p>
              <p className="mt-1 text-xs text-slate-400">{doc.caminhoArquivo}</p>
            </div>
          </div>
        </Card>

        <Card title="Texto extraído" className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{doc.textoExtraido}</p>
        </Card>
      </div>

      <ModalConfirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir documento"
        message={`Deseja excluir "${doc.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
