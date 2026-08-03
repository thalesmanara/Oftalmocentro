# Relatório — Etapa 21: Context Window Manager

Data: 2026-08-03  
Escopo: montagem orçada do contexto entre retrieval e o modelo, sem refazer busca.

---

## 1. Montagem antiga encontrada

Em `IA - RECUPERAR CONTEXTO` → nó **Montar contexto atual**: concatenação de todos os chunks selecionados com cabeçalhos `[Fontes N]`, sem orçamento de tokens, sem remoção de redundância orçada e sem `contextMeta`.

Fluxo Consulta antes: classificar → RECUPERAR (já montava contexto) → prompt → OpenAI.

## 2. Limite real do modelo

- Prompt ativo: `AI_QUERY_MAIN` / `gpt-4.1-mini`
- `max_tokens` resposta: **800**
- Capacidade teórica do modelo: ~1M tokens (família 4.1)
- **Limite operacional adotado:** `contextLimitTokens = 32000` (conservador, não a capacidade máxima)

## 3. Estratégia de tokenização

`conservative_char_div_3`: `ceil(chars / 3)`  
Estimativa determinística conservadora para PT/UTF-8, com reservas explícitas. Sem tiktoken no runtime n8n. Documentado em `contextMeta.tokenizer`.

## 4. Fórmula do orçamento

```
availableContextTokens =
  modelContextLimit
  − reservedResponseTokens
  − reservedSystemTokens (ou tokens do system prompt, o maior)
  − questionTokens
  − safetyMarginTokens
```

Seed: 32000 − 1200 − max(2000, system) − pergunta − 800.

## 5. Configuração inicial

| Versão | Modo | Status |
|--------|------|--------|
| **context-v1** | LEGACY | **PUBLISHED** |
| **context-budget-v1** | BUDGETED | **DRAFT** |

Código: `AI_QUERY_CONTEXT`.

LEGACY = equivalência à montagem anterior (inclui selectedChunks até maxChunks, mede tokens sem corte agressivo).  
BUDGETED = seleção por ranking + diversidade + orçamento + redundância; vizinhos **off**.

## 6. Migration

Idempotente:

- `ai_context_configs`
- `ai_context_config_versions` (+ unique partial `uq_ai_context_one_published`)
- colunas em `ai_test_results` / `ai_test_runs` / `ai_test_metrics`

## 7. Subworkflows

| Nome | ID |
|------|-----|
| IA - CARREGAR CONTEXT CONFIG | `70fd9924711b45f1` |
| IA - VALIDAR CONTEXT CONFIG | `0289408b8d774379` |
| IA - GERENCIAR JANELA DE CONTEXTO | `e95a92295d7c4deb` |
| Admin list/detail/create/update/validate/publish/rollback | `7995…` / `e4c0…` / `5fbd…` / `68ac…` / `5b6d…` / `f830…` / `708b…` |

Reutilizados: AUDITORIA, CARREGAR PROMPT ATIVO, RECUPERAR CONTEXTO.

## 8. Contratos

**Entrada CWM:** question, classificationJson, selectedChunksJson, retrievalMetaJson, promptConfigurationJson, legacyContext, sourcesJson, contextConfigVersionId, contextConfigOverrideAllowed, requestId/userId/sessionId.

**Saída:** context, sources, includedChunks, excludedChunks, contextMeta (completo), promptMeta interno.

API pública da Consulta: `contextMeta` resumido (sem chunks); sources sem chunkId/scores.

## 9. Algoritmo de seleção

1. Normalizar candidatos (ordem do retrieval preservada)
2. Redundância (se habilitada / BUDGETED)
3. Filtro OCR POOR/FAILED/MANUAL_REVIEW
4. minChunkScore (só BUDGETED, se > 0)
5. LEGACY: slice(maxChunks)
6. BUDGETED: percorrer ranking, respeitar maxPerDoc + custo estimado ≤ availableContextTokens
7. Detectar conflito multi-fonte/vigência
8. Formatatar blocos; se vazio → insufficientContext + abstenção

## 10–12. Redundância / diversidade / vizinhos

- Redundância: chunkId, contentHash, overlap textual ≥ threshold; **não** colapsa linhas tabulares distintas
- Diversidade: `maxChunksPerDocument`
- Vizinhos: suportados só em `BUDGETED_WITH_NEIGHBORS`; **desativados** em produção e no draft budget

## 13–15. Tabular / OCR / conflitos

- Blocos `[FONTE N — TABELA]` com aba/linhas; conteúdo tabular não transformado em prosa
- OCR: grades ruins excluídas; legado sem grade mantido
- Conflito: aviso interno no contexto; não resolve com IA

## 16–18. Insuficiente / formatação / fontes

- `insufficientContext=true` + bloco de abstenção
- Formatação estável `[FONTE N]` sem scores/UUIDs/paths
- Fontes deduplicadas só dos chunks incluídos

## 19–20. Dataset / métricas

Colunas novas + Avaliar passa a ler `contextMeta` (versão, tokens, included/excluded, fallback, insufficient, conflict, utilization).

## 21. Comparação LEGACY × BUDGETED

Smoke:

| | LEGACY (prod) | BUDGETED (override) |
|--|---------------|---------------------|
| Planilha enfermagem | 11 chunks / ~4669 tok / 8 fontes | — |
| Biometria override | — | 12 chunks / ~4905 tok / 7 fontes |
| Fallback CWM | false | false |
| Retrieval | hybrid-v1 | hybrid-v1 |

Sem regressão funcional aparente no smoke; BUDGETED não publicado.

## 22–24. Ganhos / regressões / publicação

**Ganhos:** orçamento mensurável, meta padronizada, fallback, admin, health.  
**Regressões:** `conflictDetected` ainda sensível (múltiplas fontes).  
**Recomendação:** manter **LEGACY / context-v1** em produção; validar `context-budget-v1` via dataset A/B antes de publicar.

## 25–28. Auditoria / Health / Backup / React

- Auditoria: `AI_CONTEXT_BUILD_STARTED|SUCCESS|FALLBACK` (+ ações de governança nos admins)
- Health: `contextWindow`
- Backup: tabelas de config/versões incluídas no PG; sem contexto integral
- React: `/ia/contexto` (menu SISTEMA → Janela de Contexto), permissão `editar_configuracoes`

## 29–31. Testes / Build / sync

- Smoke Consulta + override BUDGETED: OK
- GET ai-context / detail: OK
- Produção retrieval HYBRID/hybrid-v1 + context LEGACY/context-v1
- hybrid-rerank-v1 e context-budget-v1 DRAFT
- `npm run build`: OK
- `workflow_history` sincronizado após publish

## 32. Situação final da produção

```
classificar
→ IA - RECUPERAR CONTEXTO   (HYBRID / hybrid-v1)
→ IA - CARREGAR PROMPT ATIVO
→ IA - GERENCIAR JANELA DE CONTEXTO  (LEGACY / context-v1)
→ OpenAI
→ resposta
```

## 33. Riscos restantes

- Estimativa de tokens aproximada (não tiktoken)
- conflictDetected pode ser barulhento
- Admin create/update herdados de retrieval podem precisar ajuste fino de SQL em edge cases
- Dataset run com `contextConfigVersionId` depende do webhook de dataset encaminhar o campo (coluna já existe; wiring lab a validar em execução completa)

## 34. Prep. cache semântico

Já existem `normalizedQuestion` / `questionHash` no retrievalMeta; CWM não implementa cache.

## 35. Arquitetura preservada

- Retrieval não refeito / pesos intactos
- Re-ranking candidato DRAFT
- Vizinhos off em produção
- Sem novos serviços
- Sem cache semântico
