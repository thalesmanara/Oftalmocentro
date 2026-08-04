# Relatório — Etapa 24
## Response Quality Layer (Camada de Qualidade da Resposta)

**Data:** 2026-08-04  
**Status:** Concluída

---

### 1. Arquitetura encontrada

Pipeline de produção (antes da Etapa 24):

```
Classificar → RECUPERAR CONTEXTO → Evidence → Prompt → CWM
→ Cache SHADOW lookup → OpenAI → SALVAR CACHE → Preparar sucesso → Respond
```

A resposta nascia em `Message a model` (`@n8n/n8n-nodes-langchain.openAi`).  
O envelope final era montado em `Aplicar cache save` com `answer`, `sources`, `evidenceMeta`, `cacheMeta`, `contextMeta`, `retrievalMeta`.

Sem alterar Retrieval, Evidence, CWM, Cache, Prompts, OCR, Embeddings, Qdrant ou Planilhas — apenas **inserção** da validação após OpenAI.

### 2. Estrutura criada

Inserção oficial:

```
OpenAI → IA - VALIDAR RESPOSTA → Aplicar validação resposta → IA - SALVAR CACHE → resposta
```

Produz `responseMeta` (quality score/grade, cobertura, conflitos, consistência, alucinação, issues).  
A resposta textual **não é reescrita** (passthrough); documentos **nunca** são alterados.

### 3. Subworkflows

| ID | Nome |
|----|------|
| `c24ResponseQuality01` | **IA - VALIDAR RESPOSTA** |

### 4. Workflows alterados

- **Consulta IA** (`8EXk5RkFW5cxnenL`): após `Message a model` → Quality → `Aplicar validação resposta` → `IA - SALVAR CACHE`
- `Aplicar cache save`: usa answer validado + inclui `responseMeta`
- `Montar resposta cache`: inclui `evidenceMeta` + `responseMeta` (skipped no HIT / SHADOW)
- Health probe + wrapper admin (`qAyYc9DrHIqe4L9i`, `2UPHcxASp2PboC9M`)
- Admin quality (list/detail/create/update/validate/publish/rollback/compare)

### 5–6. Tabelas / Migration

- `ai_response_quality_configs` / `ai_response_quality_config_versions`
- Colunas lab em `ai_test_results` / `ai_test_runs` / `ai_test_metrics`
- Arquivo: `tmp/response-quality/migration.sql`
- Secrets: `response_quality_active_mode=VALIDATE`, `response_quality_active_version=response-quality-v1`

### 7. Algoritmo do Quality Score (0–100)

Determinístico, sem segundo LLM:

| Fator | Peso aprox. |
|-------|-------------|
| Cobertura documental (count + evidence score) | 22 |
| Evidence score médio | 14 |
| Quantidade de fontes | 12 |
| Sem conflito | 10 |
| Contexto suficiente | 8 |
| OCR médio das fontes | 8 |
| Baixa redundância/repetição | 8 |
| Confiança das evidências | 10 |
| Resposta objetiva | 8 |

Penalidades: vazio, sem fontes, alucinação, frase proibida, curto/longo, refs inexistentes, expirado, fuga de contexto, cobertura baixa, negativa sem base.

Grades: EXCELLENT ≥85, GOOD ≥70, ACCEPTABLE ≥55, LOW ≥40, POOR &lt;40.

### 8. Regras de validação

- resposta vazia / muito curta / muito longa  
- ausência de fontes / fontes duplicadas  
- referências inexistentes (`[n]` fora do range)  
- conflito documental (via evidence/context meta)  
- contexto insuficiente / fallback  
- excesso de repetição lexical  
- baixa cobertura (overlap tokens × fontes)  
- frases proibidas (lista configurável)  
- fuga do contexto documental  
- documento expirado / removido (somente validação)

### 9. Consistência

`consistencyStatus`: **OK** | **WARNING** | **ERROR**

ERROR quando: alucinação, refs inexistentes, vazia, fonte removida, conflito não explicado com linguagem absoluta, ou issues ERROR.

### 10. Cobertura documental

- `evidenceCoverage` — combinação de contagem de evidências + score médio  
- `sourceCoverage` — fontes únicas + overlap lexical resposta↔títulos/categorias/pergunta  
- `citationQuality` — agrega fontes, cobertura e ausência de refs inválidas

### 11. Fontes

Validação sem mutação: duplicidade, expiração, removido, refs numéricas inválidas, entidades (CPF/CNPJ) ausentes no blob de fontes.

### 12. Integração

- Input: answer OpenAI + sources + evidenceMeta + contextMeta + retrievalMeta + override lab  
- Output: `responseMeta` no `data` da Consulta IA (junto de `evidenceMeta`/`cacheMeta`)  
- Cache SHADOW inalterado (continua sem servir resposta)

### 13. Governança

Mesmo padrão Prompt/Retrieval/Context/Cache/Evidence: DRAFT → VALIDATING → PUBLISHED → ARCHIVED/REJECTED; **uma** PUBLISHED (unique partial index).

### 14. Endpoints

| Método | Path |
|--------|------|
| GET | `/webhook/system/ai-response-quality` |
| GET | `/webhook/system/ai-response-quality/detail` |
| POST | `/webhook/system/ai-response-quality/create` |
| PUT | `/webhook/system/ai-response-quality/update` |
| POST | `/webhook/system/ai-response-quality/validate` |
| POST | `/webhook/system/ai-response-quality/publish` |
| POST | `/webhook/system/ai-response-quality/rollback` |
| GET | `/webhook/system/ai-response-quality/compare` |

### 15. React

- Rota: `/ia/qualidade`  
- Menu Sistema → **Qualidade da Resposta**  
- `AiResponseQualityPage.tsx` + `aiResponseQualityService.ts`  
- Health UI: componente `responseQuality`  
- Lab override: `responseQualityConfigVersionId` em `aiValidationService`

### 16. Dataset

Colunas lab adicionadas para:

Average Quality Score, Coverage, Consistency, Conflict Rate, Hallucination Rate, Missing Sources, Citation Quality, latency.

(Populate completo no EXECUTAR DATASET pode ser reforçado em etapa futura, como Evidence.)

### 17. Health

`responseQuality`: versão ativa, mode, drafts, published count; placeholders para score médio / conflitos / consistência / grades (agregados 7d quando lab alimentar métricas).

### 18. Auditoria (ações emitidas pelo runtime)

- `AI_RESPONSE_VALIDATION_STARTED` / `COMPLETED`  
- `AI_RESPONSE_LOW_QUALITY`  
- `AI_RESPONSE_CONFLICT`  
- `AI_RESPONSE_HALLUCINATION`  

Sem registrar a resposta completa.

### 19. Backup

Tabelas de governança incluídas no inventário quando o workflow de backup lista configs (`ai_response_quality_configs` / `_versions`) — verificar/reforçar no job FULL se necessário.

### 20. Testes

Smoke `tmp/response-quality/e24-smoke.mjs`: **23/23 OK**

- helpers: vazio, curto, sem fontes, completo, conflito, expirado, config validate  
- admin list/detail/compare/validate  
- health `responseQuality`  
- consulta live com `responseMeta` (ex.: score 87–88 EXCELLENT/GOOD)  
- `evidenceMeta` e `cacheMeta` intactos  

### 21. Build

`npm run build` — OK (tsc + vite).

### 22. Publicação

| Versão | Status | Mode |
|--------|--------|------|
| **response-quality-v1** | **PUBLISHED** | VALIDATE |
| **response-quality-v2** | **DRAFT** | VALIDATE_STRICT |

Nenhuma publicação automática de v2.

### 23. Compatibilidade

Confirmado:

- nenhuma infraestrutura nova instalada;  
- Retrieval / Re-rank / Evidence / CWM / Cache / Prompts / OCR / Embeddings / Qdrant / Planilhas **não** tiveram algoritmos alterados;  
- produção estável com Consulta IA retornando `responseMeta`;  
- **response-quality-v1 PUBLISHED**;  
- **response-quality-v2 permanece DRAFT**.

### 24. Riscos restantes

1. Cache HIT futuro (não-SHADOW) ainda marca quality como skipped — validar HIT quando o modo servir resposta.  
2. Métricas 7d no health ainda null até o dataset persistir colunas novas de forma contínua.  
3. Heurísticas de alucinação são conservadoras (falsos positivos/negativos possíveis).  
4. Overlap lexical é aproximado (PT sem stemming avançado).

### 25. Recomendações futuras

- Popular agregados diários de quality no health  
- Validar path Cache HIT quando sair de SHADOW  
- Expandir frases proibidas / entidades por domínio clínico  
- Dashboard de grades no laboratório (`/ia/validacao`)  
- Testes OCR/planilha/negativos dedicados no dataset com asserts de `responseMeta`

---

**Arquivos-chave**

- `tmp/response-quality/migration.sql`  
- `tmp/response-quality/quality-helpers.mjs`  
- `tmp/response-quality/e24-apply-seed.mjs`  
- `tmp/response-quality/e24-create-runtime.mjs`  
- `tmp/response-quality/e24-admin.mjs`  
- `tmp/response-quality/e24-smoke.mjs`  
- `src/pages/AiResponseQualityPage.tsx`  
- `src/services/aiResponseQualityService.ts`
