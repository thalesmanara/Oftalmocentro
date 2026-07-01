import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentFormData, Tag } from '@/types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { TagBadge } from '@/components/ui/TagBadge'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getTags } from '@/services/tagsService'
import { useSettings } from '@/hooks/useSettings'
import { ACCEPTED_FILE_TYPES, formatFileSize } from '@/utils/document'

interface DocumentFormProps {
  initial?: Partial<DocumentFormData>
  initialTagIds?: string[]
  initialDocumentTags?: Tag[]
  initialFile?: {
    fileName?: string | null
    fileType?: string | null
    fileSize?: number | null
  }
  onSubmit: (data: DocumentFormData) => void | Promise<void>
  onCancel: () => void
  submitLabel?: string
  submitting?: boolean
}

function resolveInitialTagIds(
  initialTagIds?: string[],
  initial?: Partial<DocumentFormData>,
  initialDocumentTags?: Tag[]
): string[] {
  return Array.from(
    new Set([
      ...(initialTagIds ?? []),
      ...(initial?.tagIds ?? []),
      ...(initialDocumentTags?.map((tag) => tag.id) ?? []),
    ])
  )
}

export function DocumentForm({
  initial,
  initialTagIds,
  initialDocumentTags,
  initialFile,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
  submitting = false,
}: DocumentFormProps) {
  const { settings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [sectorId, setSectorId] = useState(initial?.sectorId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [semanticDescription, setSemanticDescription] = useState(initial?.semanticDescription ?? '')
  const [tagIds, setTagIds] = useState<string[]>(() =>
    resolveInitialTagIds(initialTagIds, initial, initialDocumentTags)
  )
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [sectors, setSectors] = useState<{ value: string; label: string }[]>([])
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])

  useEffect(() => {
    void Promise.all([getSectors(), getCategories(), getTags()]).then(([s, c, t]) => {
      setSectors([
        { value: '', label: 'Selecione...' },
        ...s.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name })),
      ])
      setCategories([
        { value: '', label: 'Selecione...' },
        ...c.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name })),
      ])

      const activeTags = t.filter((x) => x.active)
      const documentTags = initialDocumentTags ?? []
      const mergedTags = [...activeTags]

      for (const tag of documentTags) {
        if (!mergedTags.some((item) => item.id === tag.id)) {
          mergedTags.push(tag)
        }
      }

      setAvailableTags(mergedTags)
    })
  }, [initialDocumentTags])

  const selectedTags = useMemo(() => {
    const byId = new Map(availableTags.map((tag) => [tag.id, tag]))
    for (const tag of initialDocumentTags ?? []) {
      if (!byId.has(tag.id)) byId.set(tag.id, tag)
    }

    return tagIds
      .map((id) => byId.get(id))
      .filter((tag): tag is Tag => Boolean(tag))
  }, [availableTags, initialDocumentTags, tagIds])

  const addTag = (tagId: string) => {
    setTagIds((prev) => Array.from(new Set([...(prev ?? []), tagId])))
  }

  const removeTag = (tagId: string) => {
    setTagIds((prev) => (prev ?? []).filter((id) => id !== tagId))
  }

  const toggleTag = (tagId: string) => {
    if (tagIds.includes(tagId)) {
      removeTag(tagId)
      return
    }
    addTag(tagId)
  }

  const isValid =
    title.trim() &&
    sectorId &&
    categoryId &&
    semanticDescription.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    void onSubmit({
      title: title.trim(),
      sectorId,
      categoryId,
      semanticDescription: semanticDescription.trim(),
      tagIds: Array.from(new Set(tagIds)),
      expirationDate: expirationDate || null,
      file,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Setor"
          value={sectorId}
          onChange={(e) => setSectorId(e.target.value)}
          options={sectors}
          required
        />
        <Select
          label="Categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categories}
          required
        />
      </div>
      <Textarea
        label="Descrição Semântica"
        value={semanticDescription}
        onChange={(e) => setSemanticDescription(e.target.value)}
        required
      />
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Tags selecionadas ({tagIds.length})
        </p>
        {selectedTags.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-500">Nenhuma tag selecionada.</p>
        )}
        <p className="mb-2 text-sm font-medium text-slate-700">Adicionar ou remover tags</p>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const selected = tagIds.includes(tag.id)
            const color = tag.color ?? '#64748b'
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  selected ? 'text-white ring-2 ring-offset-1' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={
                  selected
                    ? ({ backgroundColor: color, '--tw-ring-color': color } as React.CSSProperties)
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selected ? 'rgba(255,255,255,0.5)' : color }}
                />
                {tag.name}
              </button>
            )
          })}
        </div>
      </div>
      <Input
        label="Data de vigência"
        type="date"
        value={expirationDate}
        onChange={(e) => setExpirationDate(e.target.value)}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Upload de arquivo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            disabled={submitting}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={() => fileInputRef.current?.click()}
            style={{ backgroundColor: settings.primaryColor }}
            className="text-white hover:opacity-90"
          >
            Escolher arquivo
          </Button>
        </div>
        {initialFile?.fileName && !file && (
          <p className="text-sm text-slate-600">
            Arquivo atual: {initialFile.fileName}
            {initialFile.fileType ? ` · ${initialFile.fileType}` : ''}
            {initialFile.fileSize ? ` · ${formatFileSize(initialFile.fileSize)}` : ''}
          </p>
        )}
        {file && (
          <p className="text-sm text-slate-600">
            Novo arquivo: {file.name}
            {file.type ? ` · ${file.type}` : ''}
            {` · ${formatFileSize(file.size)}`}
          </p>
        )}
        <p className="text-xs text-slate-400">
          Formatos aceitos: PDF, Word, Excel, CSV e TXT. O arquivo é enviado após salvar os dados do documento.
        </p>
      </div>
      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={submitting || !isValid}
          style={{ backgroundColor: settings.primaryColor }}
          className="text-white hover:opacity-90"
        >
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
