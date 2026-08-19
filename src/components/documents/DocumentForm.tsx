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
import {
  ACCEPTED_FILE_TYPES,
  formatFileSize,
  MAX_UPLOAD_SIZE_BYTES,
  validateFileClientSide,
} from '@/utils/document'

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
  /** Exibe o controle "Documento ativo" (somente na edição de um documento existente). */
  showActiveField?: boolean
}

export function DocumentForm({
  initial,
  initialFile,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
  submitting = false,
  showActiveField = false,
}: DocumentFormProps) {
  const { settings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [sectorId, setSectorId] = useState(initial?.sectorId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? '')
  const [semanticDescription, setSemanticDescription] = useState(initial?.semanticDescription ?? '')
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
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

  const handleFileChange = (selected: File | null) => {
    if (!selected) {
      setFile(null)
      setFileError(null)
      return
    }

    const result = validateFileClientSide(selected)
    setFile(selected)
    setFileError(result.ok ? null : result.message)
  }

  const isValid =
    title.trim() &&
    sectorId &&
    categoryId &&
    semanticDescription.trim() &&
    !fileError

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

    if (file) {
      const result = validateFileClientSide(file)
      if (!result.ok) {
        setFileError(result.message)
        return
      }
    }

    const cleanId = (value: string) => {
      const trimmed = value.trim()
      return !trimmed || trimmed === 'undefined' || trimmed === 'null' ? '' : trimmed
    }

    void onSubmit({
      title: title.trim(),
      sectorId: cleanId(sectorId),
      categoryId: cleanId(categoryId),
      subcategoryId: cleanId(subcategoryId) || null,
      semanticDescription: semanticDescription.trim(),
      expirationDate: expirationDate || null,
      isActive,
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
      {showActiveField && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span>
              <span className="font-medium">Documento ativo</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Documentos inativos permanecem armazenados no sistema, mas não são utilizados nas
                consultas da IA.
              </span>
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Upload de arquivo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            disabled={submitting}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
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
            {initialFile.fileSize != null ? ` · ${formatFileSize(initialFile.fileSize)}` : ''}
          </p>
        )}
        {file && (
          <p className="text-sm text-slate-600">
            Novo arquivo: {file.name}
            {file.type ? ` · ${file.type}` : ''}
            {` · ${formatFileSize(file.size)}`}
          </p>
        )}
        {fileError && <p className="text-sm text-red-600">{fileError}</p>}
        <p className="text-xs text-slate-400">
          Formatos permitidos: PDF, DOC, DOCX, XLS, XLSX, CSV, TSV e TXT. Tamanho máximo:{' '}
          {formatFileSize(MAX_UPLOAD_SIZE_BYTES)}. O arquivo é enviado após salvar os dados do
          documento.
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
