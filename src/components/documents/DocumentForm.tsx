import { useEffect, useState } from 'react'
import type { DocumentFormData, Tag } from '@/types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getTags } from '@/services/tagsService'
import { ACCEPTED_FILE_TYPES } from '@/utils/document'

interface DocumentFormProps {
  initial?: Partial<DocumentFormData>
  onSubmit: (data: DocumentFormData) => void
  onCancel: () => void
  submitLabel?: string
}

export function DocumentForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
}: DocumentFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [sectorId, setSectorId] = useState(initial?.sectorId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [semanticDescription, setSemanticDescription] = useState(initial?.semanticDescription ?? '')
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? [])
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
      setAvailableTags(t.filter((x) => x.active))
    })
  }, [])

  const toggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      sectorId,
      categoryId,
      semanticDescription,
      tagIds,
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
        <p className="mb-2 text-sm font-medium text-slate-700">Tags</p>
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
        label="Data de validade"
        type="date"
        value={expirationDate}
        onChange={(e) => setExpirationDate(e.target.value)}
      />
      <div>
        <label className="text-sm font-medium text-slate-700">Upload de arquivo</label>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
        <p className="mt-1 text-xs text-slate-400">
          PDF, DOC, DOCX, XLS, XLSX, CSV, TXT — upload mockado (futuro: FormData → n8n)
        </p>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
