# Etapa 18 — Camada corporativa de embeddings (relatório)

Atualizado: 2026-08-03

## 1. Estrutura encontrada
- Pipeline: Upload → Processar documento → Tika/OCR ou Tabular → chunks (`document_chunks.chunk_text`) → **EMBEDDING - ORQUESTRAR** → Promover versão.
- `document_chunks` já tinha `qdrant_point_id` (reservado; não usado nesta etapa).
- Baseline: ~465 chunks, ~53 documentos, tamanho médio ~1133 chars (teto ~1200).
- Consulta IA permanece textual (workflow `8EXk5RkFW5cxnenL` **não alterado** nesta etapa).

## 2. Modelo escolhido
`text-embedding-3-small` (OpenAI oficial).

Justificativa: melhor custo/qualidade para corpus documental PT, suporte a dims reduzidas no futuro, padrão atual OpenAI; `text-embedding-3-large` seria ~6× mais caro sem ganho necessário antes do Qdrant.

## 3. Dimensão
**1536** (default do modelo; compatível com Qdrant Cosine/Dot).

## 4. Custo estimado
- Preço de referência OpenAI: ~US$ 0,02 / 1M tokens (small).
- Backfill 465 chunks × ~300 tokens ≈ **~140k tokens ≈ US$ 0,003**.
- Operação contínua: regeneração só com `content_hash` diferente.

## 5. Migration
Idempotente em `tmp/embeddings/migration.sql`:
- `document_chunks`: `content_hash`, `embedding_model`, `embedding_dimensions`, `embedding_status`, timestamps, `embedding_hash`, `embedding_version`, `embedding_generation_ms`, `embedding_token_count`, `embedding_vector jsonb`, attempts/error/retry.
- `document_versions`: status agregado + contagens + modelo/dims/avg_ms.
- `ai_test_runs`: `embedding_model`, `embedding_version`.
- Secrets em `app_secrets`.

## 6. PostgreSQL
- **pgvector não instalado** → vetor em `embedding_vector jsonb` (temporário).
- Secret: `embedding_storage=postgres_jsonb_temp`.
- Backfill: **465/465 VALID**, dims 1536.
- Hash SHA-256 do texto do chunk; mismatch ⇒ INVALID ⇒ regenerar só o chunk.

## 7. Workflows (ativos)
| Nome | ID |
|------|-----|
| EMBEDDING - ORQUESTRAR | LJQZ2HrG6qJGN0Q2 |
| EMBEDDING - GERAR | D1bbCBEdKuNQc9F5 |
| EMBEDDING - VALIDAR | Feli8ssd2KggST6N |
| EMBEDDING - REPROCESSAR | x4bw9IQ5vwJSFh0y |
| EMBEDDING - FILA | 3BkmtrasXs1lORtL |
| Schedule - Embeddings Fila | HympisbYzMo0mQYP |
| POST System Embeddings Reprocess | A3ps15dPHWoN2LZf |

Processar documento chama ORQUESTRAR antes de Promover; falha de embedding bloqueia promoção.

## 8. Fila
Schedule + FILA com concorrência/batch/retry/backoff via secrets (`embedding_concurrency`, `embedding_batch_size`, `embedding_max_retries`, `embedding_timeout_ms`). Smoke IDLE ok.

## 9. Reprocessamento
REPROCESSAR + webhook admin: detecta hash diferente / INVALID / FAILED e regenera **apenas** chunks afetados.

## 10. Health
Componente `embeddings` no SYSTEM HEALTH: pendentes, válidos, inválidos/falhas, tempo médio, modelo, última geração, fila.

## 11. Auditoria
`EMBEDDING_STARTED` / `EMBEDDING_SUCCESS` / `EMBEDDING_FAILED` / `EMBEDDING_REGENERATED`. Sem vetor e sem texto do chunk.

## 12. Backup
BACKUP - BANCO omite `embedding_vector` na cópia redundante; metadados (modelo, versão, hash, status) preservados.

## 13. Dataset
`IA - EXECUTAR DATASET` grava `embedding_model` e `embedding_version` em `ai_test_runs`.

## 14. React
- Detalhe do documento + painel de versões: status, modelo, contagens, tempo/data (nunca o vetor).
- Health panel: label Embeddings.
- Laboratório IA: exibe modelo/versão de embedding no detalhe da execução.
- APIs GET Documentos / Versions / Version Detail passam a retornar campos de embedding.

## 15. Testes
- Backfill completo VALID; fila IDLE; auditoria sem vazamento; Consulta IA intacta; APIs de versão/documento patchadas.

## 16. Build
`npm run build` OK (tsc + vite).

## 17. Publicação
Workflows ativos + `n8n-sync-active-history.mjs` executado. Migration aplicada. Build React gerado em `dist/`.

## 18. Limitações
- Sem busca vetorial / Qdrant nesta etapa.
- Consulta IA continua lexical/textual.
- Vetores em JSONB (maior storage I/O que pgvector/Qdrant).
- Versões sem chunks podem ter `embedding_status` nulo (6/61).

## 19. Preparação para Qdrant
- `qdrant_point_id` já existe.
- Campos de modelo/dims/hash/status prontos para upsert idempotente.
- Próxima etapa: migrar `embedding_vector` → pontos Qdrant e apontar retrieval; limpar JSONB depois da validação.

## 20. Compatibilidade
- Nenhuma quebra na Consulta IA, OCR, tabular, versionamento, prompts ou lab de validação.
- Embeddings são camada adicional pós-chunks, pré-promoção.
