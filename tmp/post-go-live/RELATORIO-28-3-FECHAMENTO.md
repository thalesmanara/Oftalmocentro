# Relatório — Etapa 28.3 Fechamento Definitivo Pós-Go-Live

**Data:** 2026-08-08  
**Domínio frontend:** Locaweb (`oftalmocentrouberaba.com.br/oftalmocentrointeligente/`)

## 1–2. Estado inicial / hybrid-v2

| Camada | Estado ao iniciar 28.3 |
|--------|-------------------------|
| Retrieval | HYBRID / hybrid-v2 / PUBLISHED |
| hybrid-v1 | ARCHIVED |
| Prompt | v1 / 800 / PUBLISHED |
| Cache | SHADOW |
| Context / Evidence / Quality | PUBLISHED (inalterados) |

## 3–16. Similaridade semântica (cego)

Artefatos:
- `tmp/post-go-live/28-3-blind-cases.json` (39 casos, `wasInDictionary=false`)
- `tmp/post-go-live/28-3-blind-ab-results.json` (1ª rodada)
- `tmp/post-go-live/28-3-v1-v2-v3-ab.json` (2ª rodada controlada)

### Pares NÃO cadastrados
Exemplos: corpo clínico ↔ profissionais de saúde; documento societário ↔ contrato social; licença sanitária ↔ alvará; auto de vistoria ↔ AVCB; certidão enfermagem ↔ COREN; etc. Lista completa no JSON de casos.

### Métricas — 2ª rodada (mesmos 39 casos)

| Versão | Hit Rate | MRR | Latência |
|--------|----------|-----|----------|
| hybrid-v1 | 69.2% | 0.590 | 7919ms |
| **hybrid-v2** | **74.4%** | **0.621** | 8372ms |
| hybrid-v3 (só vector-only, sem lexical) | 71.8% | 0.615 | 8027ms |

1ª rodada havia mostrado regressão de v2 (variância). 2ª rodada + v3 confirma **v2 como melhor score composto**.

### Decisão retrieval
**Manter hybrid-v2 PUBLISHED.**

- Lexical expansion permanece **complementar**
- Generalização principal: hidratação de candidatos vector-only (`merge.includeVectorOnly`)
- Gate central de `is_active` independente da versão de config

hybrid-v3 permanece DRAFT (pior que v2 nesta bateria).

## 17. Exact identifiers
CNPJ pontual: resposta correta, sem aviso de resumo (smoke + summary checks OK).

## 18–20. Documento inativo / Qdrant / Cache

| Item | Status |
|------|--------|
| Gate pós-merge `Consultar/Aplicar gate ativos` | PUBLISHED em RECUPERAR CONTEXTO `9d626e9e…` |
| Qdrant backfill isActive | **634/634 (100%)** |
| QDRANT BUSCAR exige `isActive=true` | PUBLISHED `694481e5…` |
| Smoke inactive HYBRID | OK (sem leak por documentId) |
| DOCUMENT_ACTIVATED/DEACTIVATED | OK + invalidação cache wired |
| DOCUMENT_EXPIRATION_CHANGED | evento previsto; cache hook no PUT quando vigência muda (fluxo metadata) |

## 21–23. Auditoria — limpeza

| Campo | Valor |
|-------|-------|
| auditRowsBefore | **4504** |
| auditRowsRemoved | **4504** |
| auditRowsPreserved | **0** |
| Janela | 2026-08-02 → 2026-08-08 (implantação/testes) |
| auditOfficialStartAt | **2026-08-08T21:36:33.048Z** |
| Snapshot | `tmp/post-go-live/audit-pre-cleanup-summary.json` |
| Resultado | `tmp/post-go-live/28-3-audit-cleanup-result.json` |

Seed pós-limpeza: login, consulta IA, activate/deactivate → `28-3-audit-seed.json`.

## 24–28. Auditoria gerencial (React)

- Helper central: `src/utils/auditLabels.ts` (`formatAuditAction`, `formatAuditSentence`, categorias, filtro técnico)
- `AuditPage` reescrita:
  - frase natural para o gestor
  - sem requestId/path/duration/IP na listagem
  - eventos técnicos ocultos por padrão
  - “Detalhes técnicos” só Master/Technical Admin
- Permissão `visualizar_auditoria` preservada

## 29. Auditoria documental
DOCUMENT_ACTIVATED / DEACTIVATED / VERSION_CREATE confirmados após limpeza.

## 30–32. Publish retrieval auth
Já existia `requiredTechnicalAdmin=true` em publish e rollback.

Smoke:
- sem token → 401
- compras (`editar_configuracoes`, não técnico) → **403 TECHNICAL_ADMIN_REQUIRED**
- SQL manual NÃO é o fluxo operacional

## 33–36. Build / Deploy Locaweb

| Item | Status |
|------|--------|
| `npm run build` | OK → `dist/assets/index-B-Y5fMgf.js` |
| Domínio atual | ainda `index-V49IbOIr.js` |
| Deploy | **PENDÊNCIA OPERACIONAL EXTERNA** — credenciais Locaweb não disponíveis ao agente |

### Instruções de publicação manual (Locaweb)
1. Conteúdo local: pasta `dist/` (index.html, assets/, .htaccess)
2. Destino: diretório público da aplicação em `oftalmocentrointeligente/`
3. Substituir arquivos antigos; confirmar que `index.html` referencia `index-B-Y5fMgf.js`
4. Hard refresh / aba anônima no domínio

## 37. Summary warning
Revalidado: resumo explícito com aviso; CNPJ sem aviso.

## 38. Expirados
Política B preservada (penalty; não equivalente a inativo).

## 39–41. Regressão / Health / Workflows
- Gate + Qdrant + auditoria + auth publish smoke OK
- `workflow_history`: sincronizar após esta etapa se necessário (`scripts/n8n-sync-active-history.mjs`)
- Health: expirados não degradam infra

## 42. Riscos residuais
1. Bundle Locaweb ainda antigo até upload manual
2. Variância em A/B semântico (1ª vs 2ª rodada) — v2 venceu a rodada controlada completa v1/v2/v3
3. Eventos técnicos de IA ainda geram muitas linhas no banco (ocultos na UI gerencial)

## 43. Estado final das versões

| Camada | Estado |
|--------|--------|
| Retrieval | **HYBRID / hybrid-v2 / PUBLISHED** |
| hybrid-v3 | DRAFT (includeVectorOnly sem lexical) |
| Context | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | evidence-v1 / PUBLISHED |
| Response Quality | response-quality-v2 / VALIDATE_STRICT / PUBLISHED |
| Prompt | v1 / 800 / PUBLISHED |
| Re-rank / Context BUDGETED | DRAFT |
| Vizinhos / Semantic cache | off |

## 44. Arquitetura preservada

React → n8n → PostgreSQL → Arquivos → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI.

Nenhum serviço novo.
