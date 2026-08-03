# Relatório — Etapa 21.1: Consolidação e A/B do Context Window Manager

Data: 2026-08-03  
Escopo: consolidação técnica do CWM sem republicar `context-budget-v1`.

---

## 1. Problemas encontrados

1. **Avaliar (lab)** — colunas de métricas de contexto no `INSERT` sem `VALUES` correspondentes; depois `expectedIds` redeclarado (`SyntaxError`) e concatenação SQL quebrada antes do `RETURNING`.
2. **Create/Update admin** — `IA - VALIDAR CONTEXT CONFIG` deixou de emitir `configurationJson`/`contentHash`, gerando `invalid input syntax for type json` no insert/update.
3. **Conflito** — `OPPOSING_STATUS`/`DIVERGENT_VIGENCY` geravam falso positivo com fontes complementares (ex.: vários COREN / tokens genéricos de título).
4. **A/B inicial** — grupos com nomes errados (`Negativos` vs `Casos negativos`); runs com 0 resultados por falha do Avaliar.
5. **Status de run** — alguns runs ficam `FAILED` mesmo com `passed>0` e score OK (bug residual de finalização do dataset; métricas/resultados estão gravados).
6. **Create** — por um período respondeu HTTP 200 com body vazio quando o Postgres falhava após auth (corrigido com hash/json).

---

## 2. Validação central final

Workflow: `IA - VALIDAR CONTEXT CONFIG` (`0289408b8d774379`).

- Modos: `LEGACY` | `BUDGETED` | `BUDGETED_WITH_NEIGHBORS`
- Allowlist de modelo alinhada à governança de prompts
- Inteiros/ranges/coerência de orçamento (reservas &lt; limite; `maxChunksPerDocument` ≤ `maxChunks`)
- Boolean/número rejeitam string (`"false"`, `"32000"`)
- Campos desconhecidos e controlados pelo servidor rejeitados
- Resposta: `400 VALIDATION_ERROR` com `fields`
- Sucesso agora emite `configuration`, `configurationJson`, `contentHash`

---

## 3. Contratos administrativos

| Endpoint | Status |
|----------|--------|
| GET `/webhook/system/ai-context` | OK |
| GET `/webhook/system/ai-context/detail` | OK |
| POST `/webhook/system/ai-context/create` | OK (201 + version) |
| PUT `/webhook/system/ai-context/update` | OK (somente DRAFT) |
| POST `/webhook/system/ai-context/validate` | OK |
| POST `/webhook/system/ai-context/publish` | Bloqueia sem `validationRunId` |
| POST `/webhook/system/ai-context/rollback` | Existente (não usado para alterar produção nesta etapa) |
| GET `/webhook/system/ai-context/compare` | OK (`SYSTEM - AI CONTEXT COMPARE` / `8f0863b17b844c24`) |

Todos exigem `editar_configuracoes` + envelope SYSTEM/AUTH/AUDITORIA.

---

## 4–6. Create / Update / Validate

Teste real pós-correção:

- Create DRAFT válido → `201`, version id retornado
- Create mode inválido / limite negativo / campo desconhecido → `400`
- Update DRAFT → `200`
- Update PUBLISHED → bloqueado
- Validate válido → `ok:true`
- Validate bool/número string, reserva &gt; limite, maxPerDoc &gt; maxChunks, payload vazio → `400`
- Temp drafts arquivados após teste

---

## 7–8. Wiring do override e isolamento

- Frontend `/ia/validacao` e `/ia/contexto` enviam apenas `contextConfigVersionId` (+ flag interna de override no lab)
- Backend carrega config no PostgreSQL por execução; secrets/produção intocados
- Runs A/B: `context_mode_override_used=true` com `context-v1` ou `context-budget-v1`
- Produção paralela permaneceu `LEGACY` / `context-v1` (única `PUBLISHED`)

---

## 9–12. Métricas e fórmulas

Preenchimento real em `ai_test_results` (exemplo Planilhas/LEGACY):

- `estimated_context_tokens`, `available_context_tokens`, `included_chunk_count`
- `context_utilization_rate` = estimated/available (clamp 0–1)
- `relevant_context_rate`, `source_coverage` (null sem referência)
- `redundancy_rate`, `overflow_detected`, `empty_context`, `conflict_type`

No subset A/B (40×40 casos): overflow=0, empty=0, insuff=0, fallback=0.

---

## 13–14. Conflito documental

**Antes:** múltiplas fontes / POS+NEG globais / vigência com 1 token compartilhado → muitos falsos positivos.

**Agora (determinístico):**

- `CONFIRMED_CONFLICT`: mesma entidade (CPF/CRM/código) com valores monetários divergentes
- `POTENTIAL_CONFLICT`: vigência divergente com ≥2 tokens de título não genéricos; ou POS vs NEG **somente** com entidade compartilhada
- `conflictDetected=true` só para POTENTIAL/CONFIRMED
- Meta: `conflictType`, `conflictDocumentIds`, `preferredDocumentId`, `conflictReasonCode`

No A/B restaram 8 potenciais (contratos/aditivos/RH) — candidatos a conflito real de vigência/entidade, não “múltiplas fontes”.

---

## 15–20. A/B LEGACY × BUDGETED

Dataset subset (mesmos grupos/casos, retrieval `HYBRID/hybrid-v1`, sem re-rank, prompt/modelo iguais):

| Braço | Modo | n | avgScore | avgTokens | hall | fail | conflicts | overflow |
|-------|------|---|----------|-----------|------|------|-----------|----------|
| A | LEGACY / context-v1 | 40 | 93 | ~4092 | 0 | 4 | 8 | 0 |
| B | BUDGETED / context-budget-v1 | 40 | 93 | ~4092 | 0 | 4 | 8 | 0 |

Grupos: RH, Planilhas, Casos negativos, OCR (0 ativos no filtro), Financeiro.

**Veredito:** `NEUTRAL`  
**Compare endpoint:** `NEUTRAL` (overallScore delta 0)

### Ganhos
- Paridade de qualidade no subset
- Sem aumento de alucinação/overflow/insuficiência
- Métricas de contexto agora observáveis

### Regressões
- Nenhuma crítica PASS→FAIL adicional detectada entre braços (scores idênticos)

### Casos críticos
- Sem regressão relativa LEGACY→BUDGETED no subset
- Tokens equivalentes: orçamento BUDGETED não cortou neste volume de candidatos (esperado sob limite folgado)

### Recomendação de publicação
**NÃO PUBLICAR `context-budget-v1` automaticamente.** Manter DRAFT. Qualidade neutra no subset não justifica mudança de produção; exige aprovação explícita e preferencialmente dataset completo + publish controlado.

---

## 21–23. Overflow / insuficiente / fallback

- Overflow: `overflow_detected=false` em todos os 80 resultados do A/B; exclusão por orçamento (não estouro)
- Insuficiente: `insufficient_context=0` no subset; abstenção permanece no CWM quando `included.length===0`
- Fallback controlado ponta-a-ponta: **não forçado nesta etapa** (residual); caminho LEGACY + auditoria `AI_CONTEXT_BUILD_FALLBACK` já existiam na 21 — health mostra `fallbackCount7d:0`

---

## 24–25. Publish / Rollback

- Publish sem `validationRunId` → `VALIDATION_RUN_REQUIRED` (400)
- Override sem motivo/run inválido → bloqueado
- **Não** foi publicado `context-budget-v1`
- Produção final: única `PUBLISHED` = `context-v1` LEGACY
- Rollback operacional completo (publish temp → rollback) **não executado até o fim** para não arriscar produção; gates de publish validados

---

## 26. Situação final da produção

| Camada | Valor |
|--------|--------|
| Retrieval | **HYBRID / hybrid-v1 / PUBLISHED** |
| Re-ranking candidato | **hybrid-rerank-v1 / DRAFT** (não publicado) |
| Contexto | **LEGACY / context-v1 / PUBLISHED** |
| Contexto candidato | **BUDGETED / context-budget-v1 / DRAFT** |
| Vizinhos | off |
| Cache semântico | não implementado |

---

## 27. Health

`contextWindow`: `up`, `activeMode=LEGACY`, `activeVersion=context-v1`, `modelName=gpt-4.1-mini`, `draftCount≥1`, overflows/fallbacks 7d = 0. Draft não degrada.

---

## 28. Auditoria

Ações previstas na etapa 21 mantidas (create/update/validate/publish/rollback/fallback). Sem chunks/contexto/prompt/vetor/resposta integral nos registros de admin testados.

---

## 29. Backup

Tabelas de configs/versões/métricas/runs continuam no escopo de backup existente; contexto integral não é persistido como blob adicional.

---

## 30. React

- `/ia/contexto`: erros por campo, publish exige motivo ≥20 chars + `validationRunId`, link validação
- `/ia/validacao`: seletor **Override contexto**, envio de `contextConfigVersionId` em caso/dataset, painel de janela de contexto no resultado
- `aiContextService.compareAiContextRuns`
- Build OK

---

## 31. Compare endpoint

`GET /webhook/system/ai-context/compare?runAId=&runBId=` → runs, métricas, diferenças, gains/regressions, `verdict`.

---

## 32. Testes (amostra vs checklist 1–61)

Cobertos de forma evidenciada: validação rígida, create/update/validate, override isolado, métricas, conflito refinado, A/B subset, compare, 401, publish sem run, produção final, build, workflows publicados, sem auto-publish budget, retrieval híbrido, vizinhos off, cache não implementado.

Parciais/residual: fallback forçado ponta-a-ponta; publish+rollback transacional com versão temp até o fim; status `FAILED` espúrio no run; agregados de health 7d ainda parcialmente nulos; dataset completo (não só subset).

---

## 33. Build

`npm run build` — sucesso (tsc + vite).

---

## 34. Publicação e sincronização

Workflows atualizados com `workflow_history` + `publish_workflow` MCP, incluindo:

- VALIDAR, CWM, EXECUTAR TESTE/DATASET, run-case/dataset, CREATE, UPDATE, COMPARE

---

## 35. Riscos restantes

1. Status de run `FAILED` com casos PASS (finalizador do dataset)
2. Conflitos POTENTIAL em contratos/aditivos — revisar fingerprints se necessário
3. BUDGETED ainda não diferenciou tokens no subset (pouca pressão de orçamento)
4. Fallback injetado não revalidado nesta consolidação
5. Publish/rollback E2E com versão temp incompleto por opção de segurança

---

## 36. Confirmação: `context-budget-v1` não publicado automaticamente

**Confirmado.** Permanece `DRAFT`.

---

## 37. Arquitetura preservada

Fluxo: classificar → RECUPERAR CONTEXTO → CARREGAR PROMPT → **GERENCIAR JANELA** → OpenAI.  
Retrieval inalterado (HYBRID). Re-rank DRAFT. Vizinhos off. Sem cache semântico. Produção em LEGACY/context-v1.

---

### Artefatos

- `tmp/rerank/_c211-retest.json` — A/B + métricas
- `tmp/rerank/_c211-admin-ab.json` — primeira bateria
- Scripts `tmp/rerank/c211-*.mjs`
