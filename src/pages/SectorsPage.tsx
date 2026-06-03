import {
  getSectors,
  createSector,
  updateSector,
  deleteSector,
} from '@/services/sectorsService'
import type { Sector } from '@/types'
import { CrudPage } from '@/components/crud/CrudPage'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export function SectorsPage() {
  return (
    <CrudPage<Sector>
      title="Setores"
      description="Cadastro de setores da clínica"
      columns={[
        { key: 'nome', label: 'Nome' },
        { key: 'descricao', label: 'Descrição' },
        {
          key: 'ativo',
          label: 'Status',
          render: (s) => (
            <Badge variant={s.ativo ? 'success' : 'danger'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge>
          ),
        },
      ]}
      loadItems={getSectors}
      onCreate={async (data) => {
        await createSector({
          nome: (data.nome as string) ?? '',
          descricao: data.descricao as string,
          ativo: data.ativo !== false,
        })
      }}
      onUpdate={async (id, data) => {
        await updateSector(id, data)
      }}
      onDelete={async (id) => { await deleteSector(id) }}
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
