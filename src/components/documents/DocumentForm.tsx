import { useEffect, useState } from 'react'
import type { DocumentFormData } from '@/types'
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
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [setor, setSetor] = useState(initial?.setor ?? '')
  const [categoria, setCategoria] = useState(initial?.categoria ?? '')
  const [descricaoSemantica, setDescricaoSemantica] = useState(initial?.descricaoSemantica ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [dataValidade, setDataValidade] = useState(initial?.dataValidade ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [sectors, setSectors] = useState<{ value: string; label: string }[]>([])
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([getSectors(), getCategories(), getTags()]).then(
      ([s, c, t]) => {
        setSectors([{ value: '', label: 'Selecione...' }, ...s.filter((x) => x.ativo).map((x) => ({ value: x.nome, label: x.nome }))])
        setCategories([{ value: '', label: 'Selecione...' }, ...c.filter((x) => x.ativo).map((x) => ({ value: x.nome, label: x.nome }))])
        setAvailableTags(t.filter((x) => x.ativo).map((x) => x.nome))
      }
    )
  }, [])

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      titulo,
      setor,
      categoria,
      descricaoSemantica,
      tags,
      dataValidade: dataValidade || null,
      arquivo,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Setor" value={setor} onChange={(e) => setSetor(e.target.value)} options={sectors} required />
        <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} options={categories} required />
      </div>
      <Textarea
        label="Descrição Semântica"
        value={descricaoSemantica}
        onChange={(e) => setDescricaoSemantica(e.target.value)}
        required
      />
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Tags</p>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                tags.includes(tag)
                  ? 'bg-[var(--color-primary,#0d4f8b)] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <Input
        label="Data de validade"
        type="date"
        value={dataValidade}
        onChange={(e) => setDataValidade(e.target.value)}
      />
      <div>
        <label className="text-sm font-medium text-slate-700">Upload de arquivo</label>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
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
