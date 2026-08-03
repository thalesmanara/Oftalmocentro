# Etapa 20 — Re-ranking inteligente

Data: 2026-08-03  
Produção ativa: **HYBRID / hybrid-v1** (não alterada para HYBRID_RERANK)

## 1. Ranking atual encontrado

Busca híbrida na Consulta IA (`8EXk5RkFW5cxnenL`):

- Embedding pergunta → Qdrant + busca textual PostgreSQL → merge
- Fórmula híbrida (Merge): `0,65 × vectorNorm + 0,35 × textNorm + boosts`
- Boosts: subcategoria +0,15; categoria +0,10; OCR EXCELLENT/GOOD +0,05; tabular +0,05; isCurrent +0,05
- Pool ampliado para 30 candidatos após merge; corte final por config (`finalLimit=12` no HYBRID publicado)

## 2. Baseline medido

Grupo **Planilhas** (dataset), modo publicado **HYBRID / hybrid-v1**:

| Campo | Valor |
|---|---|
| Run ID | `eaa6f2d2-7bb6-4059-9b11-437f07644f6c` (e reexecuções posteriores) |
| Score | **100.00** |
| Status | SUCCESS |
| `retrieval_mode` | HYBRID |
| `retrieval_config_version` | hybrid-v1 |
| Latência run (smoke) | ~6–10 s (grupo pequeno) |

Consulta IA smoke: HTTP 200, resposta com fontes documentais, sem exposição de chunks/vetores.

## 3. Sinais utilizados (determinísticos)

Usados no subworkflow `IA - RE-RANQUEAR CANDIDATOS`:

- `vectorScore`, `textScore`, `hybridScore` (mergedScore)
- match categoria / subcategoria
- title match, exact identifier (CPF, CRM, OCT, códigos, monetário)
- tabular (`sheetName`, `chunkKind`)
- OCR grade (EXCELLENT/GOOD leve boost)
- `isCurrent` / stale penalty
- diversidade por documento + dedupe por `chunkId` / `contentHash`

## 4. Normalização dos scores

- Vector: `clip01` (já em [0,1] Cosine)
- Text: `batchMax` (score textual / max do lote)
- Hybrid prior: `batchMinMax` no modo HYBRID_RERANK; passthrough no HYBRID
- Score ausente = sinal omitido (não erro); candidatos só texto ou só vetor preservados

## 5. Fórmula final (candidato `hybrid-rerank-v1`, DRAFT)

```
rerankScore =
  0,45 × normalizedVector
+ 0,25 × normalizedText
+ 0,15 × normalizedHybridPrior
+ boosts (title, identifier, classification, tabular, OCR, vigência)
− penalties (redundância extra no mesmo doc, stale, comprimento útil baixo)
```

Em seguida: diversidade (`maxChunksPerDocument=2`) → Top `finalLimit=8`.

## 6. Configuração e versionamento

Tabelas:

- `ai_retrieval_configs`
- `ai_retrieval_config_versions` (DRAFT / VALIDATING / PUBLISHED / ARCHIVED / REJECTED)

Secrets:

- `retrieval_active_mode=HYBRID`
- `retrieval_active_version=hybrid-v1`
- `retrieval_config_code=AI_QUERY_RETRIEVAL`

Versões:

| Label | Status | Mode |
|---|---|---|
| hybrid-v1 | **PUBLISHED** | HYBRID |
| hybrid-rerank-v1 | DRAFT | HYBRID_RERANK |

## 7. Migration

`tmp/rerank/migration.sql` — configs + colunas de métricas em `ai_test_runs` / `ai_test_results` / `ai_test_metrics`.

## 8. Subworkflows

| Nome | ID |
|---|---|
| IA - CARREGAR RETRIEVAL CONFIG | `sClDEVNVS0TGG2uq` |
| IA - RE-RANQUEAR CANDIDATOS | `nivEQHAqHWIwP8P8` |

## 9. Workflows alterados

- Consulta IA — load config → IF HYBRID_RERANK → rerank com fallback híbrido
- SYSTEM - HEALTH CHECK — componente `retrieval` + chain Qdrant corrigida
- GET System Health — allowlist `retrieval`
- BACKUP - BANCO — inclui `ai_retrieval_*`
- IA - EXECUTAR DATASET — grava `retrieval_mode` + `retrieval_config_version`
- Admin: GET/POST/PUT retrieval (lista, detail, create, update, validate, publish, rollback)

## 10. Modos de retrieval

`TEXT_ONLY` | `VECTOR_ONLY` | `HYBRID` | `HYBRID_RERANK`  

Produção: **HYBRID**. `HYBRID_RERANK` só após publicação administrativa do draft.

## 11. Diversidade e deduplicação

- `maxChunksPerDocument` configurável
- Dedupe por `chunkId` e `contentHash`
- Não força diversidade se só um documento for relevante

## 12. Vigência e conflitos

Prioridade: relevância → vigência recente → atualização → versão vigente (`isCurrent`).  
Versões antigas fora da recuperação padrão; metadados suficientes para a resposta reconhecer conflito.

## 13. Integração tabular

Boost apenas com combinação pergunta ↔ `sheetName` / estrutura tabular (não boost indiscriminado).

## 14. Integração OCR

EXCELLENT/GOOD: leve boost; ACCEPTABLE: neutro/leve; POOR/FAILED fora da busca; legado nulo não descartado.

## 15. Dataset e métricas

Colunas novas: `retrieval_config_version`, latências, `fallback_used`, `candidates_*`, Recall@K / Precision@K / MRR / hit_rate (schema pronto).  
Baseline Planilhas carimbado com `hybrid-v1`.

## 16. Comparação HYBRID × HYBRID_RERANK

- Produção **não** publicada em HYBRID_RERANK.
- Comparação offline (`tmp/rerank/_hybrid-vs-rerank.json`): no caso OCT, rerank favorece identificador + tabular e aplica diversidade (máx. 2 chunks/doc).
- Dataset comparativo completo em produção depende de publicação controlada do draft ou `modeOverride` em laboratório.

## 17. Latência

- Re-ranking determinístico: tipicamente &lt; 20 ms (sem LLM).
- Baseline Planilhas: ~6–10 s (custo dominante = Consulta IA / OpenAI).

## 18. Fallback

Se rerank falhar: ranking híbrido atual, `fallbackUsed=true`, auditoria `AI_RERANK_FAILED` / `AI_RERANK_FALLBACK`, sem erro ao usuário.

## 19. Auditoria

Ações: `AI_RERANK_STARTED|SUCCESS|FAILED|FALLBACK`, `AI_RETRIEVAL_CONFIG_PUBLISHED|ROLLBACK` (+ draft create/update).  
Sem texto completo de chunks, vetores ou prompts.

## 20. Health

Componente `retrieval`: mode, version, drafts, fallbacks 7d, latência média rerank, última validação.  
Falha recorrente do reranker → degraded (não down).

## 21. Backup

`ai_retrieval_configs` e `ai_retrieval_config_versions` incluídos no backup de banco.

## 22. React

- Página `/ia/retrieval` (`AiRetrievalPage`) — padrão da governança de prompts
- Serviço `aiRetrievalService.ts`
- Menu lateral + link em Validação IA
- Permissão `editar_configuracoes`
- Publicado imutável; edição só em DRAFT

## 23. Testes (smoke)

| Teste | Resultado |
|---|---|
| Login | OK |
| 401 sem token em `/ai-retrieval` | OK |
| GET lista configs | OK |
| GET detail (2 versões) | OK |
| Health `retrieval` | OK |
| Baseline Planilhas HYBRID score 100 | OK |
| Consulta IA contrato | OK |
| Validate happy-path | OK |
| Validate rejeita inválido | PARCIAL (clone do validate de prompts ainda permissivo) |

## 24. Build

`npm run build` — **sucesso**.

## 25. Publicação

Subworkflows e Consulta IA publicados.  
**Configuração de retrieval em produção permanece `hybrid-v1` / HYBRID.**  
Draft `hybrid-rerank-v1` não publicado.

## 26. Riscos restantes

- Endpoints create/update/publish/rollback/validate foram clonados dos prompts; create/publish precisam validação operacional antes de uso em produção.
- Validate ainda não rejeita de forma consistente payloads inválidos.
- Continuity/vizinhos de chunk: flag `enableNeighbors=false` (não ativado).
- Métricas Recall@K / MRR no agregador do dataset ainda precisam de preenchimento completo no runner.
- Comparação A/B completa no dataset exige execução explícita em modo candidato.

## 27. Cross-encoder futuro

Não instalado. Re-ranking determinístico é barato e explicável. Avaliar cross-encoder local só se o draft `hybrid-rerank-v1` não ganhar no dataset (fontes/alucinação/MRR) sem regressão de latência.

## 28. Produção só mudou mediante validação/publicação

Confirmado: secrets e versão publicada = HYBRID / hybrid-v1. Consulta IA só chama rerank se `mode === HYBRID_RERANK`.

## 29. Arquitetura preservada

React → n8n → PostgreSQL / Qdrant → OpenAI preservada.  
Busca híbrida intacta; re-ranking é camada opcional posterior; OCR, tabular, embeddings, prompts e auditoria compatíveis.

---

### Artefatos

- `tmp/rerank/migration.sql`
- `tmp/rerank/seed-configs.mjs`
- `tmp/rerank/expand-core.mjs`
- `tmp/rerank/patch-consulta.mjs`
- `tmp/rerank/_baseline.json`
- `tmp/rerank/_hybrid-vs-rerank.json`
- `tmp/rerank/RELATORIO-ETAPA-20.md` (este arquivo)
