import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoriesService'
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
        { key: 'nome', label: 'Nome' },
        { key: 'descricao', label: 'Descrição' },
        {
          key: 'ativo',
          label: 'Status',
          render: (c) => (
            <Badge variant={c.ativo ? 'success' : 'danger'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
          ),
        },
      ]}
      loadItems={getCategories}
      onCreate={async (data) => {
        await createCategory({
          nome: (data.nome as string) ?? '',
          descricao: data.descricao as string,
          ativo: data.ativo !== false,
        })
      }}
      onUpdate={async (id, data) => {
        await updateCategory(id, data)
      }}
      onDelete={async (id) => { await deleteCategory(id) }}
      renderForm={(_, setData, data) => (
        <div className="space-y-4">
          <Input
            label="Nome"
            value={(data.nome as string) ?? ''}
            onChange={(e) => setData({ ...data, nome: e.target.value })}
            required
          />
          <Input
            label="Descrição"
            value={(data.descricao as string) ?? ''}
            onChange={(e) => setData({ ...data, descricao: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.ativo !== false}
              onChange={(e) => setData({ ...data, ativo: e.target.checked })}
              className="rounded"
            />
            Ativo
          </label>
        </div>
      )}
    />
  )
}
