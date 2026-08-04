# Relatório — Etapa 23
## Evidence Layer (Camada de Evidências)

**Data:** 2026-08-04  
**Status:** Concluída

---

### 1. Arquitetura encontrada

Pipeline de produção (antes):

```
Classificar → RECUPERAR CONTEXTO → Aplicar contexto → Carregar prompt
→ GERENCIAR JANELA (CWM) → Cache SHADOW → OpenAI → resposta
```

`selectedChunks` vinham do retrieval com scores (hybrid/rerank), títulos, setor/categoria, OCR grade e vigência. O CWM já fazia redundância e conflito internos. Nada disso foi removido — a Evidence Layer **consolida e estrutura** antes do CWM.

### 2. Estrutura criada

Inserção oficial:

```
Retrieval → Evidence Layer → Context Window Manager → Prompt/LLM
```

Cada evidência: `evidenceId`, document/version/chunk ids, título, setor, categoria/sub, `sourceType`, OCR grade, scores, `evidenceScore`/`grade`, vigência, flags, confidence, `chunkText`, `sourceMetadata`, labels.  
Sem vetores, hashes internos ou paths.

### 3. Subworkflows

| ID | Nome |
|----|------|
| `c23EvidenceRuntime01` | **IA - CONSTRUIR EVIDÊNCIAS** |

### 4. Workflows alterados

- **Consulta IA** (`8EXk5RkFW5cxnenL`): após `Aplicar contexto recuperado` → Evidence → `Aplicar evidências` → prompt → CWM  
- CWM continua recebendo `selectedChunks` compatíveis (derivados das evidências)  
- Health probe + wrapper admin  
- Admin evidence (list/detail/create/update/validate/publish/rollback/compare)

### 5–6. Tabelas / Migration

- `ai_evidence_configs` / `ai_evidence_config_versions`  
- Colunas lab em `ai_test_results` / `ai_test_runs` / `ai_test_metrics`  
- Arquivo: `tmp/evidence/migration.sql`  
- Secrets: `evidence_active_mode=STRUCTURED`, `evidence_active_version=evidence-v1`

### 7. Algoritmo Evidence Score (0–100)

Determinístico, só sinais existentes:

- retrieval/hybrid (~35%) + rerank/relevance (~25%)  
- OCR grade (+/−)  
- tabular (+), vigente/atual (+/−), expirado (−25)  
- categoria (+), texto curto (−), texto longo (+)  
- Grades: EXCELLENT ≥85, GOOD ≥70, ACCEPTABLE ≥55, LOW ≥40, POOR &lt;40  
- Confidence: HIGH / MEDIUM / LOW

### 8. Classificação (regras)

Positiva/negativa, tabular, OCR, normativa, operacional, financeira, clínica — por regex/metadados, sem LLM.

### 9. Conflitos

Consolidação: `conflictDetected`, `conflictType` (`CONFIRMED_CONFLICT` / `POTENTIAL_CONFLICT` / `NO_CONFLICT`), `preferredEvidence`/`preferredDocument`, `conflictingDocuments`, `reasonCode` (`DIVERGENT_MONETARY_VALUES`, `DIVERGENT_VIGENCY`). Reaproveita padrões da etapa 21.

### 10. Redundância

Chunk id duplicado + overlap lexical ≥ threshold → `redundancyScore`, `deduplicatedEvidenceCount`.

### 11. Fontes estruturadas

Agregação por documento com setor/categoria/OCR/tabular/vigente/`evidenceScore` — sem ids internos extras ao usuário além do `documentId` já usado na API.

### 12. Integração CWM

- `contextInput` = `{ evidences, conflicts, statistics, sources, evidenceMeta }`  
- `selectedChunks` mapeados 1:1 para o contrato CWM (comportamento LEGACY preservado)  
- `evidenceMeta` segue no fluxo da resposta (`cacheMeta` path / consulta)

### 13. Governança

Mesmo padrão Prompt/Retrieval/Context/Cache: DRAFT → VALIDATING → PUBLISHED → ARCHIVED/REJECTED; **uma** PUBLISHED (unique partial index).

### 14. Endpoints

| Método | Path |
|--------|------|
| GET | `/webhook/system/ai-evidence` |
| GET | `/webhook/system/ai-evidence/detail` |
| POST | `/webhook/system/ai-evidence/create` |
| PUT | `/webhook/system/ai-evidence/update` |
| POST | `/webhook/system/ai-evidence/validate` |
| POST | `/webhook/system/ai-evidence/publish` |
| POST | `/webhook/system/ai-evidence/rollback` |
| GET | `/webhook/system/ai-evidence/compare` |

Permissão: `editar_configuracoes`.

### 15. React

- Página `/ia/evidencias` (`AiEvidencePage.tsx`)  
- Menu Sistema → **Evidências**  
- Serviço `aiEvidenceService.ts`  
- Health label `evidenceLayer`

### 16. Dataset

Colunas de métricas de evidência adicionadas (score médio, coverage, confidence, conflict/redundancy rates, diversity, latency). Override lab: `evidenceConfigVersionId`. Datasets existentes não alterados.

### 17. Health

Componente `evidenceLayer`: versão ativa, modo, drafts, multiplePublished. Score médio por consulta disponível via `evidenceMeta` na resposta.

### 18. Auditoria

Ações: `AI_EVIDENCE_STARTED`, `AI_EVIDENCE_COMPLETED`, `AI_EVIDENCE_CONFLICT`, `AI_EVIDENCE_LOW_CONFIDENCE` (sem chunks/documentos integrais no audit payload do runtime).

### 19. Backup

Tabelas `ai_evidence_configs` / `ai_evidence_config_versions` incluídas na política de backup (sem duplicar documentos).

### 20–21. Testes / Build

- Smoke **24/24** (helpers, 401, list/detail/validate, consulta com `evidenceMeta`, health, secrets)  
- Exemplo live: `evidenceCount=7`, `averageEvidenceScore≈40.3`, `configVersion=evidence-v1`  
- `npm run build` OK  

### 22. Publicação

| Versão | Status | Mode |
|--------|--------|------|
| **evidence-v1** | **PUBLISHED** | STRUCTURED |
| **evidence-v2** | **DRAFT** | STRUCTURED_STRICT (minScore 40, dropBelow) |

Nenhuma publicação automática de v2.

### 23. Compatibilidade

Confirmado **inalterado** em produção:

- Retrieval HYBRID / hybrid-v1  
- Context LEGACY / context-v1  
- Cache SHADOW / cache-shadow-v1  
- Re-rank / Budget DRAFT  
- Prompts, embeddings, Qdrant, OCR, planilhas  

Somente inserção da camada + wiring Consulta.

### 24. Riscos restantes

1. Evidence scores médios ainda modestos em planilhas (OCR/tabular mix) — esperado; v2 DRAFT pode filtrar  
2. CWM ainda reaplica redundância/conflito — sobreposição consciente; Evidence consolida métricas upstream  
3. `evidenceMeta` no health agregado 7d ainda null até volume de métricas diárias  
4. Lab dataset ainda não popula automaticamente todas as colunas evidence sem wiring no EXECUTAR DATASET (colunas prontas)

### 25. Recomendações futuras

- Popular métricas 7d no health a partir de `ai_test_metrics` / consultas  
- Validar `evidence-v2` no laboratório antes de qualquer publish  
- Opcional: CWM BUDGETED usar `evidenceScore` como sinal de ordenação (DRAFT)  
- Deduplicar conflito CWM vs Evidence para um único aviso interno

---

### Confirmações obrigatórias

- Nenhuma infraestrutura nova (sem Redis, ES, backend paralelo)  
- Arquitetura React → n8n → PostgreSQL → Qdrant → OpenAI preservada  
- Produção estável; consulta retorna `evidenceMeta`  
- **`evidence-v1` PUBLISHED**  
- **`evidence-v2` permanece DRAFT**

### Artefatos

- `tmp/evidence/migration.sql`  
- `tmp/evidence/evidence-helpers.mjs`  
- `tmp/evidence/e23-create-runtime.mjs`  
- `tmp/evidence/e23-admin.mjs`  
- `tmp/evidence/_e23-smoke.json`  
- `tmp/evidence/RELATORIO-ETAPA-23.md`
