import { getTags, createTag, updateTag, deleteTag } from '@/services/tagsService'
import type { Tag } from '@/types'
import { CrudPage } from '@/components/crud/CrudPage'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export function TagsPage() {
  return (
    <CrudPage<Tag>
      title="Tags"
      description="Tags para classificação de documentos"
      columns={[
        { key: 'name', label: 'Nome' },
        {
          key: 'color',
          label: 'Cor',
          render: (t) =>
            t.color ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
                {t.color}
              </span>
            ) : (
              '—'
            ),
        },
        {
          key: 'active',
          label: 'Status',
          render: (t) => (
            <Badge variant={t.active ? 'success' : 'danger'}>{t.active ? 'Ativo' : 'Inativo'}</Badge>
          ),
        },
      ]}
      loadItems={getTags}
      onCreate={async (data) => {
        await createTag({
          name: (data.name as string) ?? '',
          color: (data.color as string) || null,
          active: data.active !== false,
        })
      }}
      onUpdate={async (id, data) => { await updateTag(id, data) }}
      onDelete={async (id) => { await deleteTag(id) }}
      renderForm={(_, setData, data) => (
        <div className="space-y-4">
          <Input label="Nome" value={(data.name as string) ?? ''} onChange={(e) => setData({ ...data, name: e.target.value })} required />
          <Input label="Cor (hex)" type="color" value={(data.color as string) ?? '#2563eb'} onChange={(e) => setData({ ...data, color: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={data.active !== false} onChange={(e) => setData({ ...data, active: e.target.checked })} className="rounded" />
            Ativo
          </label>
        </div>
      )}
    />
  )
}
