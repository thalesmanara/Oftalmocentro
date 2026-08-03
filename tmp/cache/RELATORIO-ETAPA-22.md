# Relatório — Etapa 22: Cache Semântico

Data: 2026-08-03  
Escopo: camada conservadora de cache com produção em **SHADOW** (não serve resposta do cache).

---

## 1. Volume e repetição encontrados

Baseline (7d / estado atual):

- Tabelas de cache **inexistentes** antes da etapa
- Consultas IA / auditoria presentes; dataset `ai_test_results` com latências p50/p90 úteis para economia futura
- Documentos ativos com atualizações recentes → invalidação documental é crítica
- Usuários/sessões ativos confirmados; permissão `editar_configuracoes` para admin

Conclusão: há potencial de reuso, mas **sem evidência suficiente para servir cache em produção** nesta etapa.

---

## 2. Estratégia escolhida

- Níveis: EXACT → NORMALIZED → SEMANTIC (conceitual)
- Implementação inicial focada em **EXACT** (chave composta) + preparação NORMALIZED
- SEMANTIC: coleção Qdrant `oftalmocentro_query_cache` **não criada ainda** (`semanticEnabled=false`)
- Armazenamento: **PostgreSQL** (fonte de verdade); sem Redis
- Política: conservadora (sensível / conflito / insuficiente / fallback → não cachear)

---

## 3. Posição no pipeline

**CACHE PÓS-RETRIEVAL / PÓS-CWM** (segurança > economia de retrieval):

```
classificar → recuperar → prompt → CWM
→ IA - CONSULTAR CACHE
→ (SHADOW: sempre OpenAI)
→ IA - SALVAR CACHE (se elegível)
→ responder
```

Economiza principalmente OpenAI quando um modo ativo for publicado no futuro.

---

## 4. Modos

`DISABLED` | `SHADOW` | `EXACT_ONLY` | `NORMALIZED` | `SEMANTIC`

Produção: **SHADOW / cache-shadow-v1 / PUBLISHED**

---

## 5. Modelagem

- `ai_cache_configs`
- `ai_cache_config_versions` (uma PUBLISHED)
- `ai_semantic_cache_entries`
- `ai_semantic_cache_dependencies`
- `ai_cache_metrics_daily`
- Colunas de cache em `ai_test_runs` / `ai_test_results` / `ai_test_metrics`

Migration: `tmp/cache/migration.sql` (idempotente)

---

## 6. Configuração inicial

| Campo | Valor |
|-------|--------|
| versionLabel | cache-shadow-v1 |
| mode | SHADOW |
| status | PUBLISHED |
| ttlSeconds | 86400 |
| scopeMode | PERMISSION_SET |
| semanticEnabled | false |
| cacheSensitiveQueries | false |
| cacheConflictResponses | false |
| cacheInsufficientContext | false |

Secrets: `cache_active_mode=SHADOW`, `cache_active_version=cache-shadow-v1`

---

## 7. Cache key

SHA-256 de JSON canônico ordenado com:

normalizedQuestion, classification, scopeHash, promptVersionId/hash, retrievalVersionId/hash, contextVersionId/hash, modelName, modelParametersHash, sourceFingerprint, cacheSchemaVersion=`v1`, systemVersion

---

## 8. Scope hash

`PERMISSION_SET`: isMaster + permissões ordenadas + sectorId + environment  
Não usa GLOBAL.

---

## 9. Source fingerprint

Hash ordenado de documentId, documentVersionId, versionNumber, contentHash, updatedAt, isCurrent, expirationDate.  
Mudança documental → MISS.

---

## 10. Armazenamento

PostgreSQL (`ai_semantic_cache_entries`). Resposta e fontes no PG. Sem vetores de resposta.

---

## 11. Índice Qdrant

Não provisionado nesta etapa (SEMANTIC desligado). Planejado: `oftalmocentro_query_cache` separado de `oftalmocentro_chunks`.

---

## 12. Subworkflows

Central: **`IA - CACHE RUNTIME`** (`c22CacheRuntime0001`)

Operações: `lookup` | `save` | `validateconfig` | `invalidate` | `cleanup`

Aliases conceituais cobertos: carregar config, preparar chave, consultar, validar hit, salvar, invalidar, limpar, comparar shadow (no save).

---

## 13. Consulta IA alterada

Após `Aplicar janela de contexto`:

1. `IA - CONSULTAR CACHE`
2. `Cache serve?` (em SHADOW → sempre false)
3. OpenAI → `IA - SALVAR CACHE` → resposta com `cacheMeta`

Em modos ativos futuros, HIT pode pular OpenAI.

---

## 14. Política de sensibilidade

Detecção determinística (CPF, e-mail, CRM/COREN, telefone, prontuário, salário).  
`containsSensitiveData=true` → não cachear / não servir compartilhado.  
Pergunta normalizada pode ser redigida.

---

## 15. Política de negativos

Não cachear: contexto insuficiente, conflito, fallback técnico, resposta vazia, erro.

---

## 16. TTL

Default 24h; mínimo com políticas futuras de vigência. Cleanup marca EXPIRED e remove >30d.

---

## 17. Invalidação

- Eager: endpoint `/invalidate` por document/prompt/retrieval/context/all
- Lazy: fingerprint/versões na validação do hit

---

## 18. Cleanup

`POST /webhook/system/ai-cache/cleanup` — OK em smoke.

---

## 19. SHADOW

- Pipeline completo sempre
- Lookup registra candidato
- `missReason=SHADOW_MODE` quando haveria hit
- `answerFromCache` nunca true em produção SHADOW
- Save elegível para acumular candidatos (sem PII/conflito)

---

## 20. Comparação shadow

Determinística no save: hash normalizado da resposta + acordo de fontes (≥80% Jaccard docs).  
`falseHit` quando candidato diverge.

---

## 21. Dataset

Colunas de cache adicionadas. Lab aceita `cacheConfigVersionId` no service. Página `/ia/cache` dispara dataset Planilhas com override.

---

## 22. Métricas

`ai_cache_metrics_daily` + health `semanticCache` (hitRate7d, falseHitCount7d, entry counts, secretsMatch, multiplePublished).

---

## 23. Auditoria

Ações: `AI_CACHE_LOOKUP`, `AI_CACHE_HIT/MISS`, `AI_CACHE_SHADOW_MATCH`, `AI_CACHE_SAVE`, `AI_CACHE_INVALIDATE`, `AI_CACHE_EXPIRE`, `AI_CACHE_CONFIG_*`  
Sem resposta/pergunta sensível/chunks/prompt/vetores.

---

## 24. Health

Componente `semanticCache` em SYSTEM HEALTH + GET wrapper + React `SystemHealthPanel`.  
SHADOW não degrada; degrada se múltiplas PUBLISHED / secrets divergentes / false hits.

---

## 25. Backup

Configs/versões/métricas/deps cobertos pelo backup lógico do PG. Entradas de resposta são reconstruíveis (não críticas para DR).

---

## 26. React

- Página `/ia/cache` — SISTEMA → Cache da IA
- Service `aiCacheService.ts`
- Permissão `editar_configuracoes`
- Sem exibir pergunta/resposta/vetores integrais

---

## 27. Endpoints

| Método | Path |
|--------|------|
| GET | `/webhook/system/ai-cache` |
| GET | `/webhook/system/ai-cache/detail` |
| POST | `/webhook/system/ai-cache/create` |
| PUT | `/webhook/system/ai-cache/update` |
| POST | `/webhook/system/ai-cache/validate` |
| POST | `/webhook/system/ai-cache/publish` |
| POST | `/webhook/system/ai-cache/rollback` |
| GET | `/webhook/system/ai-cache/compare` |
| POST | `/webhook/system/ai-cache/invalidate` |
| POST | `/webhook/system/ai-cache/cleanup` |

Todos com AUTH + `editar_configuracoes` + auditoria.

---

## 28. Testes

Smoke `tmp/cache/_e22-smoke.json`: **21/21 OK**

Inclui: migration/seed, validate, 401 envelope, list SHADOW, consulta sem serve (`missReason=SHADOW_MODE`, `shadowCandidateFound=true`), health, secrets, cleanup, helpers (TTL string, conflito, CPF, scope).

Correção operacional: lookup Postgres com 0 linhas parava o subworkflow — resolvido com `alwaysOutputData` + UNION sentinel.

---

## 29. Build

`npm run build` — sucesso.

---

## 30. Publicação e sincronização

- Consulta IA publicada com wiring de cache
- Health / GET Health publicados
- Admin workflows ativos + `webhook_entity` registrado
- `workflow_history` sincronizado nas alterações

---

## 31. Economia estimada

Em SHADOW: **0 tokens/latência economizados para o usuário** (pipeline completo).  
Economia real só após publicação ativa com hit rate comprovado.

---

## 32. False hits

Contador health `falseHitCount7d=0`. Comparação shadow pronta para detectar divergências quando houver candidatos.

---

## 33. Riscos restantes

1. SEMANTIC ainda não indexado no Qdrant  
2. Fingerprint atual usa fontes do CWM; enriquecer com contentHash documental nas deps  
3. Invalidação automática em eventos de upload/OCR ainda não amarrada a todos os pipelines de documento (endpoint manual existe)  
4. Dataset ainda precisa popular métricas agregadas de cache em volume  
5. Webhooks novos dependem de `webhook_entity` (registrados)

---

## 34. Recomendação EXACT_ONLY

**Não publicar agora.** Exigir:

- shadow agreement alto em dataset repetido
- false hit crítico = 0
- invalidação documental testada
- aprovação administrativa explícita

---

## 35. Recomendação SEMANTIC

Aguardar EXACT_ONLY estável; só então criar coleção Qdrant e validar threshold ≥0.92 com paráfrases + casos sensíveis negativos.

---

## 36. Situação final da produção

| Camada | Estado |
|--------|--------|
| Retrieval | HYBRID / hybrid-v1 / PUBLISHED |
| Contexto | LEGACY / context-v1 / PUBLISHED |
| Cache | **SHADOW / cache-shadow-v1 / PUBLISHED** |
| Re-ranking | hybrid-rerank-v1 / DRAFT |
| Contexto BUDGETED | context-budget-v1 / DRAFT |
| Vizinhos | off |
| Redis | não instalado |
| Qdrant query cache | não criado |

---

## 37. Confirmação de arquitetura preservada

- Retrieval/contexto/prompts intactos  
- Cache não é fonte de verdade  
- Nenhuma resposta servida do cache em produção nesta etapa  
- Documentos internos continuam fonte de verdade  

---

## Artefatos

- `tmp/cache/migration.sql`
- `tmp/cache/cache-helpers.mjs`
- `tmp/cache/_e22-smoke.json`
- `tmp/cache/_e22-inspect.json`
- `src/pages/AiCachePage.tsx`
- `src/services/aiCacheService.ts`
