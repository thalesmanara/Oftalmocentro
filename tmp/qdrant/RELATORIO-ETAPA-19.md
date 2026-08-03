# Etapa 19 — Banco vetorial Qdrant (relatório)

Atualizado: 2026-08-03

## 1. Infraestrutura encontrada
- Coolify service `vrv8r1yp224hzobdqqcenajo` (n8n, postgres, tika, ocr, tabular)
- Rede Docker `vrv8r1yp224hzobdqqcenajo`
- Traefik/coolify-proxy ativo; serviços internos (ocr/tabular) com `traefik.enable=false`
- Embeddings já VALID em JSONB (465); `qdrant_point_id` existia sem uso
- **Qdrant não existia** antes desta etapa

## 2. Instalação Qdrant
- Imagem: `qdrant/qdrant:v1.13.4`
- Container: `qdrant-vrv8r1yp224hzobdqqcenajo`
- Volume: `vrv8r1yp224hzobdqqcenajo_qdrant-data`
- Restart: `unless-stopped`, healthcheck TCP 6333
- **Sem publicação externa** (`expose` 6333/6334, sem `ports`, Traefik desabilitado)
- URL interna n8n: `http://qdrant:6333`

## 3. Coleção
- Nome: `oftalmocentro_chunks`
- Status: green
- Pontos: **465**

## 4. Modelo
`text-embedding-3-small` (já usado na Etapa 18)

## 5. Dimensão
**1536** (validado antes de criar a coleção)

## 6. Distância
**Cosine** (validado; compatível com embeddings OpenAI normalizados)

## 7. Migration
Idempotente (`tmp/qdrant/migration.sql` + apply via transaction):
- `document_chunks`: `embedding_synced_at`, `embedding_sync_status`, `embedding_sync_error`, `embedding_sync_attempts`, `embedding_sync_ms`
- `document_versions`: `qdrant_sync_status`, counts, collection, synced_at
- `ai_test_runs.retrieval_mode`; `ai_test_results` vector/text/merged scores
- Secrets `qdrant_*` em `app_secrets`
- Mantém `embedding_vector jsonb` (compatibilidade; Qdrant é a cópia operacional)

## 8. Workflows
| Workflow | ID |
|----------|-----|
| QDRANT - UPSERT | ihR1aNY04ZgeW0lm |
| QDRANT - ORQUESTRAR | 7d7ZE8O6DjqMAk2d |
| QDRANT - VALIDAR | q3ntUS5qHRsitZA0 |
| QDRANT - DELETE | L61YCjalRxpWU9Un |
| QDRANT - REINDEXAR | UrDNrDkE9WuwEK7H |
| QDRANT - BUSCAR | YDnrXjzYUOrZVE6N |
| Schedule - Qdrant Fila | By7xP0i0JmWy1AZD |
| POST System Qdrant Reindex | zBMDF4cbf7kMk7u2 |

## 9. Sincronização
- Point ID = UUID do chunk (idempotente)
- Payload: metadados apenas (sem texto completo / sem segredos / sem vetor no audit)
- Backfill inicial: **465/465 SYNCED**
- Processar documento: Embeddings → **QDRANT ORQUESTRAR** → Promover (READY exige sync ok)

## 10. Busca híbrida
Consulta IA: Classificar → Embed pergunta → Qdrant Top-K + SQL textual → Merge → Ranking → Prompt  
Fallback textual se Qdrant falhar. Filtros documentais preservados (boosts + filtro isCurrent).

## 11. Ranking
Ver `tmp/qdrant/RANKING.md`:
`merged = 0.65*vector + 0.35*text + boosts(subcat/cat/OCR/tabular/vigente)`

## 12. Health
Componente `qdrant`: online, coleção, pontos, pendentes, falhas, ms médio, última sync.

## 13. Auditoria
`QDRANT_UPSERT`, `QDRANT_DELETE`, `QDRANT_REINDEX`, `QDRANT_SYNC_FAILED` — sem vetores/texto.

## 14. Backup
Metadados da coleção (`qdrant_meta`); sem exportar milhões de vetores.

## 15. Dataset
`retrieval_mode` (hybrid) em runs; campos de score preparados em results.

## 16. React
- Detalhe/versões: status Qdrant, coleção, contagens, data (nunca vetor)
- Health panel: Qdrant
- Página admin `/sistema/qdrant` (status + reindexação)

## 17. Testes
Instalação, coleção, backfill 465, ports internos only, workflows publicados, build OK, history sync.

## 18. Performance
Backfill ~20 batches × ~0.5s; upsert batch 16–24; busca Qdrant tipicamente <100ms + embed pergunta OpenAI.

## 19. Build
`npm run build` OK.

## 20. Publicação
Container + migration + workflows ativos + React `dist/` + history sync.

## 21. Limitações
- Vetores ainda também em PostgreSQL JSONB (migração de limpeza futura opcional)
- Dataset ainda não compara experimentalmente text vs hybrid em UI (campos prontos)
- Ensure collection no ORQUESTRAR é best-effort (coleção já criada)
- Hydratação híbrida depende de cruzar hits Qdrant com rows textuais por `documentId:chunkIndex`

## 22. Compatibilidade
OCR, tabular, embeddings, prompts, lab e filtros documentais preservados. Arquitetura React → n8n → PostgreSQL → Arquivos → OCR/Tabular → Embeddings → **Qdrant** → Consulta IA íntegra.
