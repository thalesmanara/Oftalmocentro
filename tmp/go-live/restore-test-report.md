# Restore Test Report — Etapa 28

**Data:** 2026-08-04T13:31:40Z  
**Ambiente:** banco temporário `n8n_restore_e28` (isolado), depois removido.

## Resultado

**OK — restore lógico de subset validado em ambiente isolado.**

| Tabela | Produção | Restore | Match |
|--------|----------|---------|-------|
| documents | 58 | 58 | YES |
| users | 5 | 5 | YES |
| ai_test_cases | 100 | 100 | YES |
| app_secrets | 64 | 64 | YES |
| backup_runs | 24 | 24 | YES |

- Dump: `pg_dump -Fc` (~645 KB subset)
- Checksum SHA-256: `e1ae3cb4f631c93e1f9e77463ccec41b1b7021b9953bea8fdbc972364189d948`
- `pg_restore` exit 1 por FKs/triggers de tabelas/funções **não** incluídas no subset (esperado)
- Tabelas de dados críticas restauraram com contagens iguais
- Banco temporário e dump removidos ao final
- Produção **não** alterada

## Limitações (explícitas)

1. **Não** é restore full `pg_dump` do schema n8n completo.
2. Binários de documentos **não** restaurados (backup DOCUMENT_FILES = inventário PARTIAL).
3. Destino externo (S3/R2) **ausente**.
4. Pasta `/home/node/files/backups` no container n8n **não encontrada** nesta verificação (backups locais operacionais precisam ser confirmados no volume correto).
5. **Não** reivindicar disaster recovery completo.

## Classificação

- Restore isolado de metadados/app tables: **TESTADO**
- DR completo: **NÃO**
- Bloqueador absoluto: **NÃO**, se risco for formalmente aceito no `docs/TERMO_ACEITE.md`
