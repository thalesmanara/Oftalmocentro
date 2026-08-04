# Relatório — Etapa 22.1
## Invalidação automática e validação Shadow do Cache da IA

**Data:** 2026-08-04  
**Status:** Concluída (produção permanece SHADOW)

---

### 1. Estado inicial

- Produção: Retrieval **HYBRID/hybrid-v1**, Contexto **LEGACY/context-v1**, Cache **SHADOW/cache-shadow-v1**
- 1 entry VALID, **0 dependências**, fingerprint v1 fraco, `document_version_ids` vazios
- Invalidação eager só via admin manual; semantic Qdrant off; Redis ausente
- Re-rank `hybrid-rerank-v1` DRAFT; `context-budget-v1` DRAFT; vizinhos off

### 2. Eventos mapeados

| Família | Mecanismo |
|---------|-----------|
| Versão documental / checksum / OCR / embedding / qdrant / processing | Triggers PG em `document_versions`, `documents`, `document_chunks` → `ai_cache_invalidate_by_document(_version)` |
| Governança prompt/retrieval/context publish & rollback | `IA - INVALIDAR CACHE POR EVENTO` ligado após sucesso |
| Admin manual | `/webhook/system/ai-cache/invalidate` + runtime `invalidate_event` |

### 3. Dependências implementadas

- Tabela `ai_semantic_cache_dependencies` enriquecida (version number, content hashes, expiration, chunk opcional)
- No **save**: 1 linha `DOCUMENT_VERSION` por versão usada (evita explosão por chunk)
- Coverage em entries VALID pós-rodadas: **100%** (14 deps / 3 entries fp-v2)

### 4. Fingerprint v2

- Versão: `source-fingerprint-v2`
- JSON canônico ordenado: documentId, versionId, versionNumber, checksum, statuses, OCR, tabular, embedding, qdrant, chunk hashes
- Enrich SQL no runtime a partir de `document_versions` + `document_chunks`
- Testes unitários: ordem irrelevante; mudança de conteúdo/OCR altera hash

### 5. Validação lazy

- Após hit: carrega deps e confere `is_current`, deleted, expiration, checksum, chunk hash, estados OCR/embedding/qdrant
- Divergence → MISS + motivo (`DOCUMENT_HASH_CHANGED`, `DOCUMENT_NOT_CURRENT`, …) + invalidate seguro quando aplicável
- Soft lookup (question+scope+prompt+model) detecta candidato/stale quando a chave exact diverge por fingerprint

### 6. Subworkflow de invalidação

- **`IA - INVALIDAR CACHE POR EVENTO`** (`c221InvalidateEvent01`)
- Entrada: eventType, documentId/versionId, prompt/retrieval/context ids, modelName, reasonCode, requestId
- Saída: success, matchedEntries, invalidatedEntries, durationMs
- Delega ao **IA - CACHE RUNTIME** (`invalidate_event`)

### 7. Workflows instrumentados

- Prompt publish/rollback, Retrieval publish/rollback, Context publish/rollback
- Documentais via triggers (sem SQL espalhado)
- Cleanup schedule diário 03:00: `SCHEDULE - AI CACHE CLEANUP`

### 8–14. Invalidação por domínio

| Domínio | Status |
|---------|--------|
| Documental (update/versão) | OK — função + trigger + teste fixture sintético |
| OCR / tabular / chunks | Via trigger em `document_versions` / `document_chunks` |
| Embedding / Qdrant | Via campos monitorados no trigger de versão |
| Prompt / Retrieval / Context | Wiring eager no publish/rollback |
| Idempotência | Segunda chamada retorna 0 invalidados |

### 15. Elegibilidade

- Centralizada no runtime (`eligibility` / save gates)
- Bloqueia: sensível, conflito, insuficiente, fallback, fingerprint/deps incompletos, expirado, negativo (policy)

### 16. Sensibilidade

- CPF, CNPJ, CRM/COREN, e-mail, telefone, prontuário, matrícula, salário/remuneração
- SHADOW: não salva; `saved=false`; pergunta redigida na entry se criada indevidamente — política: não criar

### 17. TTL efetivo

- `min(config TTL, 24h institucional | 6h tabular, tempo até expiration da fonte)`
- Campos: `ttl_policy`, `effective_ttl_seconds`, `nearest_source_expiration`
- Observado: **TABULAR_6H / 21600s** em perguntas de planilha

### 18–19. Cleanup / LRU

- VALID expirado → EXPIRED; retenção 30d; orphan deps; `maxEntries` / `maxEntriesPerScope` LRU
- Endpoint cleanup OK; schedule 03:00 ativo
- Contadores: `shadow_candidate_count` vs `served_hit_count` (**served=0**)

### 20–21. Rodadas Shadow / volume

| Rodada | Resultado |
|--------|-----------|
| R1 populate | Saves elegíveis + fp v2 + deps |
| R2 exact | Após fix lookup: **shadowCandidateFound=true**, never served |
| R3 normalized | Accent-insensitive normalize; candidato |
| R4 paráfrase | Sem candidate exact (pergunta distinta) — esperado |
| R5 sensível | Não salva |
| Invalidação fixture | 100% |
| TTL/expire/cleanup | OK |

Volume representativo controlado (~11 lookups consulta + fixtures). Lookup latency ~38–77 ms nos candidates.

### 22–28. Métricas Shadow (amostra pós-fix)

| Métrica | Valor |
|---------|-------|
| Candidate rate (reteste exact) | 3/3 = **100%** no conjunto repetido |
| Answer agreement | **false** (NON_CRITICAL_DIVERGENCE — redação LLM varia) |
| Source agreement | **true** |
| False hits / critical | **0 / 0** |
| Stale candidates | instrumentado (`staleCandidate`) |
| Invalidation prevented | instrumentado |
| answerFromCache | **sempre false** |
| served_hit_count Σ | **0** |

### 29–30. Scope / Dataset

- Scope hash estável por permission set; mismatch → MISS
- Dataset lab permanece utilizável; endpoint `run-shadow-validation` documenta rodadas controladas

### 31–34. Métricas / Auditoria / Health / Backup

- `ai_cache_metrics_daily` populado (lookups, shadow candidates, agreements, blocks)
- Health `semanticCache`: mode/version/counts + shadow rates 7d + dependencyCoverage; degrada com critical false / deps incompletas / secrets
- Auditoria: ações AI_CACHE_* (lookup/shadow/false/save/invalidate/cleanup/dependency)
- Backup: configs/versões/métricas/deps cobertos pelo backup documental existente; **answers são reconstruíveis** (não vetorizar)

### 35–36. React / Endpoints

- `/ia/cache`: métricas Shadow, coverage, entries filtráveis (status/motivo/scope abbrev) **sem** pergunta/resposta
- Novos: `GET .../metrics`, `GET .../entries`, `POST .../run-shadow-validation` (`editar_configuracoes`)
- Build: **OK**

### 37–40. Testes / Build / Sync / Economia

- Unit helpers + shadow volume + invalidation + cleanup + 401 + produção: **pass**
- Workflows: history inserido antes de update; activeVersionId sincronizado
- Economia potencial: tokens/latência **ainda 0 servidos** (SHADOW); candidate reuse comprovado

### 41. Riscos restantes

1. Redação OpenAI varia → agreement textual baixo mesmo com mesmas fontes (esperado em SHADOW)
2. Fingerprint na chave exact: retrieval não determinístico reduz hits exact-only até estabilizar
3. Soft lookup mitiga medição Shadow; EXACT_ONLY exigiria estabilidade maior de retrieval/contexto
4. n8n pode exigir toggle active após patch DB (feito nesta etapa)
5. Wiring de invalidação em publish usa previousVersionId quando disponível — se o SQL de publish não expuser o id anterior, invalidação por prompt pode ser no-op (lazy + fingerprint ainda protegem)

### 42–44. Recomendação EXACT_ONLY

**Não criar draft `cache-exact-v1` nesta etapa.**

Motivos:
- Agreement de resposta textual insuficiente (NON_CRITICAL_DIVERGENCE recorrente)
- Volume Shadow ainda modesto para promoção
- Critérios conservadores: critical=0 e invalidação OK, mas agreement/source-stable ainda não justificam servir cache

**EXACT_ONLY não foi publicado.**  
**SEMANTIC permanece desligado; coleção Qdrant de perguntas não criada; Redis não instalado.**

### 45. Situação final da produção

| Camada | Estado |
|--------|--------|
| Retrieval | **HYBRID / hybrid-v1 / PUBLISHED** |
| Re-ranking | hybrid-rerank-v1 / **DRAFT** |
| Contexto | **LEGACY / context-v1 / PUBLISHED** |
| Contexto BUDGETED | context-budget-v1 / **DRAFT** |
| Cache | **SHADOW / cache-shadow-v1 / PUBLISHED** |
| Vizinhos | **off** |
| Semantic Qdrant query cache | **não criado** |
| Redis | **não instalado** |

### 46. Arquitetura preservada

- PostgreSQL fonte de verdade; cache pós-retrieval/CWM; runtime central; nenhuma resposta servida do cache; prompt/retrieval/contexto de produção **não alterados** nas rodadas comparativas.

---

### Artefatos

- `tmp/cache/migration-22.1.sql`
- `tmp/cache/cache-helpers.mjs`
- `tmp/cache/e221-upgrade-runtime.mjs`
- `tmp/cache/e221-shadow-volume.mjs` / `_e221-shadow.json`
- `tmp/cache/RELATORIO-ETAPA-22.1.md` (este arquivo)
- Workflows: `c22CacheRuntime0001`, `c221InvalidateEvent01`, `c221CacheMetrics0001`, `c221CacheEntries0001`, `c221CacheShadowRun01`, `c221CacheCleanupSched`
