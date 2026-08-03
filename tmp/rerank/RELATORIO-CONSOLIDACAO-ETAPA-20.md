# Relatório — Consolidação Etapa 20 (Re-ranking)

Data: 2026-08-03  
Produção final: **HYBRID / hybrid-v1** (inalterada para publicação automática)  
Candidato: **HYBRID_RERANK / hybrid-rerank-v1** permanece **DRAFT**

---

## 1. Problemas encontrados nos endpoints

- Clones iniciais de prompts tinham queries Postgres com `'={{ expr }}'`, que o n8n interpreta como parâmetro e injeta `=` literal → UUID/`json` inválidos e resposta HTTP vazia.
- `Publicar TX` em CTE único violava `uq_ai_retrieval_one_published` (índice único parcial) ao arquivar+publicar no mesmo statement.
- `versionLabel` vazio falhava validação de formato (corrigido: vazio = omitido).
- Create/update/publish quebravam operacionalmente até correção das expressões e do TX de publicação.

## 2. Validação central criada

Subworkflow **`IA - VALIDAR RETRIEVAL CONFIG`** (`NhWUkmzGhlttJC9S`):

- Modes: `TEXT_ONLY | VECTOR_ONLY | HYBRID | HYBRID_RERANK`
- Ranges: `candidateLimit`, `finalLimit`, `maxChunksPerDocument`
- Pesos/boosts/penalties com allowlist; booleans reais; campos proibidos rejeitados
- Retorno: `ok`, `errors[]`, `fields`, `normalized`, `contentHash`, `configurationJson`

Usado por create / update / validate (sem duplicar regras).

## 3. Contratos finais

| Método | Path | Permissão |
|--------|------|-----------|
| GET | `/webhook/system/ai-retrieval` | `editar_configuracoes` |
| GET | `/webhook/system/ai-retrieval/detail` | idem |
| POST | `/webhook/system/ai-retrieval/create` | idem → DRAFT |
| PUT | `/webhook/system/ai-retrieval/update` | idem → só DRAFT |
| POST | `/webhook/system/ai-retrieval/validate` | idem |
| POST | `/webhook/system/ai-retrieval/publish` | exige `validationRunId` ou override+motivo |
| POST | `/webhook/system/ai-retrieval/rollback` | motivo obrigatório |
| GET | `/webhook/system/ai-retrieval/compare` | **não implementado nesta consolidação** (comparação via laboratório/runs) |

Todos com SYSTEM AUTH + envelopes + `requestId`.

## 4–6. Testes create / update / validate

Executados via `tmp/rerank/run-consolidacao-tests.mjs` + probes:

| Caso | Resultado |
|------|-----------|
| Create DRAFT válido | PASS (201 + id) |
| Create mode inválido | PASS 400 |
| Update DRAFT | PASS |
| Update PUBLISHED | PASS 400 `NOT_DRAFT` |
| Validate mode/peso/campo/limites/vazio/string | PASS 400 |
| Validate válido | PASS 200 |
| 401 sem token | PASS |

## 7. modeOverride no laboratório

- Frontend envia apenas `retrievalConfigVersionId`
- `POST .../ai-eval/run-dataset` e `run-case` encaminham ao `IA - EXECUTAR DATASET` / `EXECUTAR TESTE`
- `Consulta IA` passa `versionId` a `IA - CARREGAR RETRIEVAL CONFIG` (override de leitura)
- Produção (`app_secrets`) **não** muda

## 8. Isolamento

Confirmado nos runs A/B:

- A: `mode_override_used=false`, `HYBRID` / `hybrid-v1`
- B: `mode_override_used=true`, `HYBRID_RERANK` / `hybrid-rerank-v1`
- Secrets pós-B: `retrieval_active_mode=HYBRID`, `retrieval_active_version=hybrid-v1`

## 9. Fórmulas (documental Top-K)

Com `rankedDocumentIds` (sem inventar chunk):

- **Recall@K** = \|hits ∩ expected\| / \|expected\|
- **Precision@K** = \|hits ∩ expected\| / K
- **MRR** = 1 / rank do primeiro esperado (ou 0 se ausente)
- **Hit Rate** = 1 se algum esperado em Top-K, senão 0  
Sem referência documental → métricas `null` (não zero artificial). Chunk metrics `null` se não houver `expectedChunkId`.

## 10. Cobertura das métricas

- Colunas em `ai_test_results` / `ai_test_metrics` criadas/garantidas.
- Cálculo por caso em `Avaliar e montar insert`; agregação em `IA - CALCULAR MÉTRICAS`.
- Runs A/B (grupo Planilhas, 1 caso ativo no filtro): score resposta 100/100; `recall_at_k` agregado ainda dependente de `rankedDocumentIds` preenchido no meta da Consulta — pipeline ligado; cobertura plena requer dataset maior com refs.

## 11. Runs A/B

| Braço | Run ID | Modo | Versão | Override | Score | Casos |
|-------|--------|------|--------|----------|-------|-------|
| A | `a4117044-46ea-471e-b8b6-bc635cf0ee3d` | HYBRID | hybrid-v1 | false | 100 | 1 (Planilhas) |
| B | `4fb2148c-fa72-4332-a4e6-a225809ade51` | HYBRID_RERANK | hybrid-rerank-v1 | true | 100 | 1 (Planilhas) |

Mesmo prompt/modelo/documentos; só retrieval version muda.

## 12–15. Comparação / ganhos / regressões / críticos

- **Veredito: NEUTRAL** (overallScore idêntico; sem aumento de alucinação; sem regressão crítica observada no conjunto Planilhas).
- Ganhos: não evidenciados neste subconjunto.
- Regressões: nenhuma PASS→FAIL crítica no sample.
- Casos críticos: não bloqueadores neste sample; **dataset completo ainda recomendado** antes de qualquer publicação.

## 16. Recomendação de publicação

**NÃO publicar `hybrid-rerank-v1`.**  
Manter DRAFT. Exigir A/B em conjunto representativo maior (RH, Exames, OCR, Negativos, CPF, códigos) + decisão administrativa explícita.

## 17–18. Publish / Rollback

Teste controlado (`tmp/rerank/test-publish-rollback.mjs`):

1. Create DRAFT temporário  
2. Publish com `forceOverride` + motivo ≥20 chars → secrets apontam para temp  
3. Rollback para `hybrid-v1` → secrets e única PUBLISHED restaurados  
4. Temp REJECTED  

Publish: arquivar em nó separado → promover (evita unique index).

## 19. Situação final de produção

```
retrieval_active_mode = HYBRID
retrieval_active_version = hybrid-v1
PUBLISHED count = 1 (hybrid-v1)
hybrid-rerank-v1 = DRAFT
```

## 20. Auditoria

Ações cobertas nos fluxos:  
`AI_RETRIEVAL_CONFIG_DRAFT_CREATE`, update, validation, `PUBLISHED`, `PUBLISH_OVERRIDE`, `ROLLBACK`, `AI_RERANK_FALLBACK` (reranker).  
Sem chunks/vetores/prompts integrais nos metadados de auditoria.

## 21. Health

Componente `retrieval` presente; status `ok` com produção válida. Draft não degrada.

## 22. Backup

Tabelas `ai_retrieval_configs`, `ai_retrieval_config_versions`, runs/métricas/resultados no Postgres da app (mesmo escopo de backup já existente).

## 23. React

- `/ia/retrieval`: erros por campo; publish bloqueado sem run (salvo override+motivo); dataset com override da versão selecionada; publicada somente leitura.
- `/ia/validacao`: seletor de override de retrieval; bloco Recall@K / Precision@K / MRR / Hit Rate (`n/d` quando ausente).

## 24. Testes (resumo checklist)

Passaram: validate estrito, create/update, bloqueios publish/rollback, override isolado, A/B sample, health, 401, build, workflows ativos, produção preservada.  
Pendência consciente: compare endpoint dedicado; A/B dataset completo; fallback deliberado do reranker em produção (mecanismo existe; teste de falha controlada não reexecutado nesta passagem).

## 25. Build

`npm run build` — OK (tsc + vite).

## 26. Publicação e sincronização

Workflows críticos publicados; `workflow_history` sincronizado via `tmp/rerank/sync-active-history.mjs` após patches de expressão/TX.

## 27. Riscos restantes

- A/B apenas no grupo Planilhas (1 caso) — insuficiente para promoção.
- Métricas Top-K dependem de `retrievalMeta.rankedDocumentIds` na Consulta.
- Vizinhos de chunk continuam `enableNeighbors=false`.
- Sem cross-encoder (proposital).

## 28. Confirmação — sem publicação automática do candidato

**Confirmado:** `hybrid-rerank-v1` **não** foi publicado. Produção permanece HYBRID/hybrid-v1.

## 29. Arquitetura preservada

React → n8n → PostgreSQL/Qdrant/OpenAI; re-ranking determinístico; sem cross-encoder; sem vizinhos; governança versionada mantida.
