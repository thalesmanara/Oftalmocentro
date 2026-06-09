import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoriesService'
import type { Category } from '@/types'
import { CrudPage } from '@/components/crud/CrudPage'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export function CategoriesPage() {
  return (
    <CrudPage<Category>
      title="Categorias"
      description="Categorias de documentos"
      columns={[
        { key: 'name', label: 'Nome' },
        {
          key: 'description',
          label: 'Descrição',
          render: (c) => c.description ?? '—',
        },
        {
          key: 'active',
          label: 'Status',
          render: (c) => (
            <Badge variant={c.active ? 'success' : 'danger'}>{c.active ? 'Ativo' : 'Inativo'}</Badge>
          ),
        },
      ]}
      loadItems={getCategories}
      onCreate={async (data) => {
        await createCategory({
          name: (data.name as string) ?? '',
          description: (data.description as string) || null,
          active: data.active !== false,
        })
      }}
      onUpdate={async (id, data) => { await updateCategory(id, data) }}
      onDelete={async (id) => { await deleteCategory(id) }}
      renderForm={(_, setData, data) => (
        <div className="space-y-4">
          <Input label="Nome" value={(data.name as string) ?? ''} onChange={(e) => setData({ ...data, name: e.target.value })} required />
          <Input label="Descrição" value={(data.description as string) ?? ''} onChange={(e) => setData({ ...data, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={data.active !== false} onChange={(e) => setData({ ...data, active: e.target.checked })} className="rounded" />
            Ativo
          </label>
        </div>
      )}
    />
  )
}
