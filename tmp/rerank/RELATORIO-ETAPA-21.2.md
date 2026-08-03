# Relatório — Etapa 21.2: Correções operacionais finais do laboratório e CWM

Data: 2026-08-03  
Escopo: finalização de runs, fallback controlado do CWM, publish+rollback E2E seguro, health/auditoria/secrets, React e restauração de produção.

---

## 1. Causa raiz do status incorreto

No workflow `IA - EXECUTAR DATASET` (`12t0Ol6zWQJgAKPC`), o nó **Montar atualização do run** calculava o status a partir de `$('Calcular métricas').first().json.totalCount`.

Esse valor podia ser `0` mesmo com linhas reais em `ai_test_results` (ex.: item vazio / branch / agregação), forçando `FAILED` em runs com PASS, métricas e score válidos.  
Casos FAIL funcionais do dataset eram tratados como falha técnica do run.

---

## 2. Regra oficial de status

Fonte de verdade: **resultados persistidos** (`ai_test_results`), não o total provisório das métricas.

| Status | Regra |
|--------|--------|
| `SUCCESS` | concluído, sem erro fatal, `completed>0`, `failed=0`, `error=0`, `skipped=0`, métricas geradas |
| `PARTIAL` | concluído com ≥1 caso válido e presença de FAIL funcional, ERROR de caso ou SKIPPED; métricas geradas |
| `FAILED` | erro fatal, zero casos válidos, ou métricas impossíveis por falha estrutural |
| `RUNNING` / `STARTED` / `CANCELLED` | estados de ciclo de vida (inalterados) |

Invariantes:

```
totalCases = passed + failed + skipped + error
completedCases = passed + failed + skipped + error
```

Casos FAIL do dataset = avaliação funcional, **não** `FAILED` técnico do run.

---

## 3. Subworkflow / consolidação

Não foi criado um workflow novo isolado. A regra foi **centralizada** em:

- `IA - EXECUTAR DATASET` → **Montar atualização do run** (status definitivo)
- `IA - CALCULAR MÉTRICAS` → status provisório alinhado (sem sobrescrever com regra divergente no React)

React apenas **exibe** o status do banco (`runStatusHint` em `/ia/validacao`).

---

## 4. Runs históricos corrigidos

Reparo idempotente seguro (resultados + métricas + ausência de erro fatal):

- **12** runs `FAILED` inconsistentes reclassificados para `SUCCESS`/`PARTIAL`

Runs ambíguos sem evidência **não** foram alterados.

---

## 5. Testes de status

| Cenário | Resultado |
|---------|-----------|
| Planilhas 100% PASS | `SUCCESS` |
| Financeiro 13 PASS + 1 FAIL | `PARTIAL` |
| Run válido com score não termina `FAILED` | OK |
| React / relatório usam status do banco | OK |

---

## 6. Estratégia de falha controlada

Parâmetro interno: `forceContextFailureForTest` (+ `contextConfigOverrideAllowed`).

Gate em `Consulta IA`:

- exige `editar_configuracoes` (ou master)
- exige override explícito
- fora disso o flag é ignorado (`'false'`)
- nunca vira configuração persistida

No CWM (`Montar janela`): se flag ativo → lança `TEST_INJECTED_CONTEXT_FAILURE` → catch monta LEGACY (`legacyContext`) com `fallbackUsed=true` e `fallbackReason` sanitizado.

---

## 7. Casos de fallback executados

1. Consulta textual (funcionários Excel)  
2. Consulta negativa (dados inexistentes)  
3. Lab `TC-053` (Planilhas / tabular)  
4. Lab `TC-011` (Documentos)  
5. Força sem override (deve ignorar)

---

## 8. Resultado do fallback

- HTTP **200** com resposta útil  
- `contextMeta.fallbackUsed=true`  
- `fallbackReason=TEST_INJECTED_CONTEXT_FAILURE`  
- Lab: `ai_test_results.context_fallback_used=true`  
- Sem stack / sem nodes / sem contexto integral no envelope  
- Sem override: `fallbackUsed=false`

**Causa do falha inicial do lab:** `forceContextFailureForTest` não estava declarado no `executeWorkflowTrigger` do CWM / DATASET / TESTE — n8n descartava o input. Corrigido.

---

## 9. Auditoria do fallback

Eventos `AI_CONTEXT_BUILD_FALLBACK` gravados (ex.: 2026-08-03T23:15… / 23:19…).  
Sem prompt/chunks/resposta/vetores/secrets no payload auditado.

---

## 10. Health do fallback

`components.contextWindow.fallbackCount7d` refletiu os testes (ex.: 3 após bateria final).  
Status do bloco `contextWindow`: `ok`.

---

## 11. Configuração temporária criada

Exemplos E2E:

- `context-e2e-temp-20260803231940` (e anteriores)  
- Modo `LEGACY` equivalente a `context-v1`  
- Status inicial `DRAFT`

---

## 12. Run de validação usado

Ex.: run `a076e574-57c0-49d1-8777-df8290db4911` (grupo Planilhas) → `SUCCESS`, vinculado como `validationRunId`.

---

## 13. Publicação temporária

Fluxo real `SYSTEM - AI CONTEXT PUBLISH` com override auditado.  
Temp promovida a única `PUBLISHED`.

---

## 14. Estado durante publicação

| Item | Valor |
|------|--------|
| PUBLISHED | só a temp |
| `context_active_version` | temp |
| `retrieval_active_version` | **hybrid-v1** (preservado) |
| Health `activeVersion` | temp |
| Retrieval | HYBRID / hybrid-v1 |

---

## 15. Rollback executado

`SYSTEM - AI CONTEXT ROLLBACK` → `targetVersionId=context-v1` (`3007bd85-782e-4057-bd48-63e7cb060d73`).  
Auditoria `AI_CONTEXT_CONFIG_ROLLBACK`.

---

## 16. Estado após rollback

- `context-v1` = única `PUBLISHED` / `LEGACY`  
- temp = `ARCHIVED`  
- `context-budget-v1` = `DRAFT`  
- secrets context/retrieval coerentes  

---

## 17. Limpeza realizada

- Temps `context-e2e-temp-*` arquivadas  
- Flag de falha só em runtime (não persistida)  
- Produção forçada de volta a context-v1 + hybrid-v1  
- Trilha de auditoria e runs preservados  

---

## 18. Situação final dos secrets

| Key | Value |
|-----|--------|
| `retrieval_active_mode` | `HYBRID` |
| `retrieval_active_version` | `hybrid-v1` |
| `context_active_mode` | `LEGACY` |
| `context_active_version` | `context-v1` |

**Bug crítico corrigido nesta etapa:** publish/rollback de contexto atualizavam `retrieval_active_*` (corrupção observada: `LEGACY`/`context-v1` em retrieval). Passaram a upsert apenas `context_active_*`.

---

## 19. Situação final das versões

| Label | Status | Mode |
|-------|--------|------|
| `context-v1` | PUBLISHED | LEGACY |
| `context-budget-v1` | DRAFT | BUDGETED |
| `context-e2e-temp-*` | ARCHIVED | LEGACY |
| `hybrid-v1` | PUBLISHED | HYBRID |
| `hybrid-rerank-v1` | DRAFT | HYBRID_RERANK |

`multiplePublishedCount=0` (contexto).

---

## 20. Situação final da produção

| Camada | Estado |
|--------|--------|
| Retrieval | HYBRID / hybrid-v1 / PUBLISHED |
| Re-ranking candidato | hybrid-rerank-v1 / DRAFT |
| Contexto | LEGACY / context-v1 / PUBLISHED |
| Contexto BUDGETED | context-budget-v1 / DRAFT |
| Vizinhos | off |
| Cache semântico | não implementado |

---

## 21. React

- `/ia/validacao`: badges SUCCESS/PARTIAL/FAILED + hints  
- Diferencia FAIL de caso vs FAILED de run  
- Banner de fallback CWM no detalhe do run  
- `aiContextService.rollback` envia `targetVersionId`  
- Tipo `contextFallbackReason` adicionado no service  
- Build OK (`tsc` + `vite build`)

---

## 22. Auditoria

Confirmados:

- `AI_CONTEXT_BUILD_FALLBACK`  
- `AI_CONTEXT_CONFIG_PUBLISHED`  
- `AI_CONTEXT_CONFIG_ROLLBACK`  
- (create/validate de drafts em etapas anteriores)

Sem exposição de contexto/prompt/chunks/vetores/secrets/stacks.

---

## 23. Health

`GET System Health` + `SYSTEM - HEALTH CHECK`:

- `contextWindow` lido do banco/`app_secrets` (não mais hardcoded)  
- Campos: `activeMode`, `activeVersion`, `fallbackCount7d`, `lastValidationRun`, `lastValidationScore`, `secretsMatchPublished`, `multiplePublishedCount`, `invalidConfigCount`  
- Pós-teste: `activeVersion=context-v1`, `secretsMatchPublished=true`, `multiplePublishedCount=0`

Nota: `retrievalPipeline` pode aparecer `degraded` por `fallbackCount7d` de retrieval ≥ 20 (histórico); fora do escopo de status de contexto.

---

## 24. Backup

Runs, configs, histórico de publicação, `validationRunId`, métricas e auditoria continuam no escopo do backup lógico existente. Nenhuma cópia de contexto integral adicionada.

---

## 25. Testes (checklist)

| # | Item | Status |
|---|------|--------|
| 1–6 | Status SUCCESS/PARTIAL/FAILED | OK |
| 7–8 | React/relatório | OK |
| 9 | Histórico reparado (12) | OK |
| 10–13 | Fallback textual/tabular/doc/negativo | OK |
| 14–18 | Flags, auditoria, health, 200, sem stack | OK |
| 19–31 | Temp create→validate→publish→rollback | OK |
| 32–36 | Budget DRAFT, retrieval, rerank, vizinhos, cache | OK |
| 37–38 | Auditoria publish/rollback + backup | OK |
| 39 | 401 | OK |
| 42–45 | Build, workflows publicados, sync history, prod final | OK |
| 46 | Sem exposição sensível | OK |

---

## 26. Build

`npm run build` — sucesso (Vite 6, bundle gerado).

---

## 27. Publicação e sincronização

Workflows atualizados via `workflow_history` + `workflow_entity.versionId/activeVersionId` + MCP `publish_workflow`, incluindo:

- `IA - GERENCIAR JANELA DE CONTEXTO`  
- `IA - EXECUTAR TESTE` / `IA - EXECUTAR DATASET`  
- `Consulta IA`  
- `SYSTEM - AI CONTEXT PUBLISH` / `ROLLBACK`  
- `SYSTEM - HEALTH CHECK`  
- `GET System Health`

---

## 28. Riscos restantes

1. Fallback de teste incrementa `fallbackCount7d` (esperado; não é indisponibilidade).  
2. Health de retrieval pode permanecer `degraded` por volume histórico de fallbacks de retrieval (independente do CWM).  
3. O parâmetro `forceContextFailureForTest` existe no caminho lab/admin — depende continuamente do gate de permissão.  
4. Temps arquivadas permanecem no histórico (proposital para auditoria).

---

## 29. Confirmação: `context-budget-v1` não publicado

**Confirmado:** permanece `DRAFT` / `BUDGETED`. Nenhuma publicação automática.

---

## 30. Confirmação de arquitetura preservada

- Sem nova arquitetura de retrieval  
- Sem publicação de BUDGETED  
- Sem cache semântico  
- Vizinhos off  
- Produção final = estado obrigatório inicial  

---

## Artefatos de evidência

- `tmp/rerank/_c212-final-e2e.json`  
- `tmp/rerank/_c212-lab-fb.json`  
- `tmp/rerank/_c212-fb-verify.json`  
- Scripts `tmp/rerank/c212-*.mjs`
