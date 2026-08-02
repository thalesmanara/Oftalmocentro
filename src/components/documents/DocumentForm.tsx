import { useEffect, useRef, useState } from 'react'
import type { DocumentFormData } from '@/types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { getSectors } from '@/services/sectorsService'
import { getCategories } from '@/services/categoriesService'
import { getSubcategories } from '@/services/subcategoriesService'
import { useSettings } from '@/hooks/useSettings'
import { ACCEPTED_FILE_TYPES, formatFileSize } from '@/utils/document'

interface DocumentFormProps {
  initial?: Partial<DocumentFormData>
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

export function DocumentForm({
  initial,
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
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? '')
  const [semanticDescription, setSemanticDescription] = useState(initial?.semanticDescription ?? '')
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [sectors, setSectors] = useState<{ value: string; label: string }[]>([])
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [subcategories, setSubcategories] = useState<{ value: string; label: string }[]>([])
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(null)

  useEffect(() => {
    setOptionsError(null)
    void Promise.all([getSectors(), getCategories()])
      .then(([s, c]) => {
        setSectors([
          { value: '', label: 'Selecione...' },
          ...s.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name })),
        ])
        setCategories([
          { value: '', label: 'Selecione...' },
          ...c.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name })),
        ])
      })
      .catch(() => {
        setOptionsError('Não foi possível carregar setores e categorias.')
      })
  }, [])

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([])
      setSubcategoryId('')
      setSubcategoriesError(null)
      return
    }

    let cancelled = false
    setLoadingSubcategories(true)
    setSubcategoriesError(null)

    void getSubcategories(categoryId)
      .then((items) => {
        if (cancelled) return
        const active = items
          .filter((item) => item.active)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        setSubcategories(active.map((item) => ({ value: item.id, label: item.name })))

        if (subcategoryId && !active.some((item) => item.id === subcategoryId)) {
          setSubcategoryId('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubcategories([])
          setSubcategoriesError('Não foi possível carregar subcategorias.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubcategories(false)
      })

    return () => {
      cancelled = true
    }
    // subcategoryId omitted intentionally — only reload when category changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const handleCategoryChange = (value: string) => {
    setCategoryId(value)
    setSubcategoryId('')
  }

  const isValid =
    title.trim() &&
    sectorId &&
    categoryId &&
    semanticDescription.trim()

  const subcategoryOptions = !categoryId
    ? [{ value: '', label: 'Selecione uma categoria primeiro' }]
    : loadingSubcategories
      ? [{ value: '', label: 'Carregando subcategorias...' }]
      : subcategoriesError
        ? [{ value: '', label: 'Erro ao carregar subcategorias' }]
        : subcategories.length === 0
          ? [{ value: '', label: 'Nenhuma subcategoria cadastrada' }]
          : [{ value: '', label: 'Opcional — selecione...' }, ...subcategories]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    void onSubmit({
      title: title.trim(),
      sectorId,
      categoryId,
      subcategoryId: subcategoryId || null,
      semanticDescription: semanticDescription.trim(),
      expirationDate: expirationDate || null,
      file,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {optionsError && <p className="text-sm text-red-600">{optionsError}</p>}
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
          label="Categoria do documento"
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          options={categories}
          required
        />
      </div>
      <Select
        label="Subcategoria"
        value={subcategoryId}
        onChange={(e) => setSubcategoryId(e.target.value)}
        options={subcategoryOptions}
        disabled={
          !categoryId ||
          loadingSubcategories ||
          Boolean(subcategoriesError) ||
          subcategories.length === 0
        }
      />
      {subcategoriesError && <p className="text-sm text-red-600">{subcategoriesError}</p>}
      <Textarea
        label="Descrição Semântica"
        value={semanticDescription}
        onChange={(e) => setSemanticDescription(e.target.value)}
        required
      />
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
