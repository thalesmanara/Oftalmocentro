# Backup e recuperação — Oftalmocentro Inteligente

## Nível atual: operacional local

Este ambiente **não** possui disaster recovery completo.

| Capacidade | Status |
|---|---|
| Registro em `backup_runs` | Sim |
| Checksum SHA-256 | Sim (quando arquivo gerado) |
| Export lógico do banco (JSON) | Sim — **PARTIAL**, ≠ `pg_dump` |
| Inventário de documentos | Sim — sem empacotar binários |
| Export de workflows n8n (sem credenciais) | Sim — VERIFIED |
| Destino externo (S3/R2/Drive) | **Não** — sem credenciais |
| `pg_dump` | **Não** — `executeCommand` indisponível |
| Restore isolado | **Não** — sem banco temporário |
| Retenção destrutiva | **Não** — propositalmente |

## O que é gerado

Arquivos em volume local do n8n (`local:backups`, fisicamente sob `/home/node/files/`):

- `oftalmocentro_database_YYYYMMDD_HHMMSS.json`
- `oftalmocentro_n8n_workflows_YYYYMMDD_HHMMSS.json`
- `oftalmocentro_documents_YYYYMMDD_HHMMSS.json` (inventário)

Agendamento: diário ~06:00 UTC (≈ 03:00 America/Sao_Paulo).

## Endpoints

- `GET /webhook/system/backups` — status (permissão `editar_configuracoes`)
- `POST /webhook/system/backups/run` — `{ "type": "FULL" | "DATABASE" | "DOCUMENT_FILES" | "N8N_WORKFLOWS" }`

## Acesso adicional necessário (itens C)

Para elevar o nível para **backup externo + recuperação validada**:

1. Credencial S3/R2 (ou Drive/SFTP) no n8n
2. Acesso SSH/Coolify para:
   - `mkdir -p /home/node/files/backups` (ou volume dedicado)
   - instalar/`pg_dump` no container ou host
   - `tar` dos documentos
3. Banco temporário para `RESTORE_TEST` (nunca restaurar em produção)
4. Política de retenção só após restore verificado

## Scripts preparados (execução na VPS)

Ver:

- `scripts/backup-database.sh` — `pg_dump` real
- `scripts/backup-documents.sh` — `tar` dos documentos
- `scripts/restore-database-isolated.sh` — restore em banco temporário

## Frontend

Protegido por Git (`origin/main`). `.env` está no `.gitignore`. Pasta `backups/` também ignorada.
