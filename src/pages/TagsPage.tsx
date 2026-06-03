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
        { key: 'nome', label: 'Nome' },
        {
          key: 'cor',
          label: 'Cor',
          render: (t) =>
            t.cor ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: t.cor }} />
                {t.cor}
              </span>
            ) : (
              '—'
            ),
        },
        {
          key: 'ativo',
          label: 'Status',
          render: (t) => (
            <Badge variant={t.ativo ? 'success' : 'danger'}>{t.ativo ? 'Ativo' : 'Inativo'}</Badge>
          ),
        },
      ]}
      loadItems={getTags}
      onCreate={async (data) => {
        await createTag({
          nome: (data.nome as string) ?? '',
          cor: data.cor as string,
          ativo: data.ativo !== false,
        })
      }}
      onUpdate={async (id, data) => {
        await updateTag(id, data)
      }}
      onDelete={async (id) => { await deleteTag(id) }}
      renderForm={(_, setData, data) => (
        <div className="space-y-4">
          <Input
            label="Nome"
            value={(data.nome as string) ?? ''}
            onChange={(e) => setData({ ...data, nome: e.target.value })}
            required
          />
          <Input
            label="Cor (hex)"
            type="color"
            value={(data.cor as string) ?? '#2563eb'}
            onChange={(e) => setData({ ...data, cor: e.target.value })}
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
