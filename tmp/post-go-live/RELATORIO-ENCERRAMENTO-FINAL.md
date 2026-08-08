# Relatório de Encerramento Final — Oftalmocentro Inteligente

**Data:** 2026-08-08  
**Escopo:** Fechamento operacional residual pós Etapa 28.3  
**Restrições respeitadas:** sem novas funcionalidades, sem mudança de arquitetura, sem publicação de DRAFTs, sem tuning de IA.

---

## Veredito

Desenvolvimento **ENCERRADO**. Critérios de encerramento atendidos.  
Única pendência remanescente: **upload manual do frontend na Locaweb** (credenciais ausentes) → classificada como **PENDÊNCIA OPERACIONAL EXTERNA**.

---

## 1. Deploy Locaweb

| Item | Status |
|------|--------|
| Credenciais Locaweb no repo/VPS | **Ausentes** — não inventadas |
| Pacote pronto | `tmp/post-go-live/LOCAWEB-FRONTEND-FINAL.zip` (~148 KB) |
| Instruções | `tmp/post-go-live/DEPLOY-LOCAWEB.md` |
| Diretório destino | `oftalmocentrointeligente/` no site `oftalmocentrouberaba.com.br` |
| Arquivos a enviar | **todo o conteúdo de `dist/`**: `index.html`, `.htaccess`, `assets/index-B-Y5fMgf.js`, `assets/index-EQrxvzdZ.css`, `vite.svg` |
| Preservar `.htaccess` | Sim (incluído no pacote) |
| Domínio atual | ainda serve bundle antigo |

**Classificação:** `PENDÊNCIA OPERACIONAL EXTERNA` — DEPLOY MANUAL LOCAWEB.

Após o upload, validar em aba anônima: hash do JS, login, dashboard, tags EXPIRADO/VENCE EM BREVE, ordenação, ativo/inativo, Administrador Técnico, auditoria gerencial, detalhe técnico (Master/Tech Admin), Consulta IA, aviso de resumo, refresh de rota.

---

## 2. Hash do bundle local

```
npm run build → PASS
dist/assets/index-B-Y5fMgf.js   (542.89 kB)
dist/assets/index-EQrxvzdZ.css
```

Sem erro TypeScript. Sem secrets/mocks no build. Fetch concentrado via `api.ts` (padrão do projeto).

---

## 3. Hash/bundle servido em produção

| Ambiente | Bundle |
|----------|--------|
| Local `dist/` | `assets/index-B-Y5fMgf.js` |
| Produção Locaweb | `assets/index-V49IbOIr.js` (**desatualizado**) |

URL: https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/

---

## 4–7. Documento inativo — todos os modos

Fixture: `CONTRATO LOCAÇÃO ESTACIONAMENTO PACIENTES - SATYRO SILVA OLIVEIRA - ARQUIVO WORD`  
(`71e5029f-4881-4fe4-9dc9-048f178b1165`)

Fluxo: ativo → recuperar → inativar → PG `is_active=false` → consultas → reativar.

Overrides de laboratório (**DRAFT, não publicados**):

- `lab-final-TEXT_ONLY`
- `lab-final-VECTOR_ONLY`
- `hybrid-rerank-v1` (já DRAFT)

| Modo | Resultado | Leak em Sources/Evidence/Context |
|------|-----------|-----------------------------------|
| TEXT_ONLY | **PASS** | Ausente |
| VECTOR_ONLY | **PASS** | Ausente |
| HYBRID | **PASS** | Ausente |
| HYBRID_RERANK | **PASS** | Ausente |

**Critério absoluto atendido:** documento inativo NÃO entra na resposta da IA em nenhum modo testado.

Artefato: `tmp/post-go-live/28-final-ops.json`

---

## 8. Exact identifiers (regressão)

| Query tipo | Resultado |
|------------|-----------|
| CNPJ | **PASS** |
| COREN | **PASS** |
| CRM | **PASS** |
| CPF | **PASS** (abstain aceitável quando ausente no corpus) |
| AVCB / sigla | **PASS** (query precisa; phrasing ampla pode acionar aviso de resumo por política) |
| Data | **PASS** |
| Código/documento | **PASS** |
| Valor monetário | **PASS** |

`exactAllPass=true` (8/8). Sem regressão crítica lexical/exata após hybrid-v2.

---

## 9–10. Similaridade final / métricas hybrid-v2

Registrado como resultado final (sem novo tuning):

| Versão | Hit Rate | MRR |
|--------|----------|-----|
| hybrid-v1 | 69.2% | 0.590 |
| **hybrid-v2** | **74.4%** | **0.621** |
| hybrid-v3 | 71.8% | 0.615 |

Confirmado:

- hybrid-v2 permanece **PUBLISHED**
- lexicalExpansion permanece **complementar**
- vector-only hydration permanece **ativa** (`merge.includeVectorOnly`)
- exemplos cegos fora do dictionary
- **nenhuma** nova lista de sinônimos criada nesta microconsolidação

---

## 11. Qdrant isActive coverage

Live recount (2026-08-08):

| Métrica | Valor |
|---------|-------|
| totalPoints | **634** |
| pointsWithIsActive | **634** |
| pointsWithoutIsActive | **0** |
| activePoints | **634** (após reativação da fixture) |
| inactivePoints | **0** |
| orphanPoints | **0** |

- QDRANT BUSCAR exige `isActive=true` (workflow ativo `YDnrXjzYUOrZVE6N`)
- Gate pós-merge de ativos permanece em `IA - RECUPERAR CONTEXTO`

Artefato: `tmp/post-go-live/28-final-qdrant-coverage.json`

---

## 12. Cache invalidation

| Item | Status |
|------|--------|
| Eventos DOCUMENT_ACTIVATED / DEACTIVATED | **Confirmados** no ciclo real |
| PUT → `IA - INVALIDAR CACHE POR EVENTO` | **Wired** + executions `success` (ex.: 39646, 39655) |
| matchedEntries / invalidatedEntries (fixture) | **0 / 0** (idempotente — sem entradas de cache dependentes da fixture) |
| Entradas INVALIDATED no corpus | 12 (razões históricas DOCUMENT_UPDATED / VERSION_UPDATED) |
| Modo | **SHADOW** (`cache_active_mode=SHADOW`, `cache-shadow-v1`) |
| served_hit_count | **0** — nenhuma resposta servida do cache |
| shadow_candidates | 120 |

DOCUMENT_EXPIRATION_CHANGED permanece no contrato de eventos do PUT (mesmo pipeline de invalidação quando vigência muda).

Artefato: `tmp/post-go-live/28-final-cache-cycle.json`

---

## 13. Auditoria oficial

| Campo | Valor |
|-------|-------|
| auditOfficialStartAt | **2026-08-08T21:36:33.048Z** |
| Limpeza adicional | **Não realizada** (conforme instrução) |
| Novos registros após o marco | **Sim** (login, IA, activate/deactivate, embeddings, etc.) |

---

## 14. Auditoria gerencial

Apresentação (React) já entregue na 28.3 e preservada:

- `src/utils/auditLabels.ts` + `src/pages/AuditPage.tsx`
- Frases amigáveis (“cadastrou/editou/inativou documento”, “realizou uma consulta à IA”)
- Ocultos por padrão: requestId, method, path, duration, IP, JSON, action code, eventos internos Evidence/Cache/Retrieval/Quality
- “Detalhes técnicos” somente Master / Technical Admin
- Simplificação **somente de apresentação** — dados técnicos preservados no banco

Endpoint GET auditoria: **200** no smoke (lab user com permissão).

---

## 15. Workflow history

Executado explicitamente:

```bash
node scripts/n8n-sync-active-history.mjs
```

Plus sync pontual de `bae8872eeb164a27` e `YDnrXjzYUOrZVE6N`.

| Check | Resultado |
|-------|-----------|
| activeVersionId ↔ workflow_history | alinhados |
| mismatches em workflows ativos | **0** |
| Stubs ativos | nenhum identificado |
| Schedules ativos | Cache cleanup, Backup diário, Embeddings fila, Qdrant fila |

### WORKFLOW_HISTORY_SYNC = PASS

---

## 16. Build

`npm run build` → **PASS**  
Asset final: `index-B-Y5fMgf.js`

---

## 17. Smoke final (API)

`tmp/post-go-live/28-final-smoke.json` → **15/15 PASS**

Inclui: login/logout, login falho, 401, documentos, expirado/vigência, ativo/inativo, publish → `403 TECHNICAL_ADMIN_REQUIRED`, auditoria, CNPJ, similaridade, resumo/aviso, injection handled, health.

Smoke no domínio real completo **pendente do deploy Locaweb**.

---

## 18. Health

GET `/webhook/health` → **200**

---

## 19. Versões finais

| Camada | Estado |
|--------|--------|
| Retrieval | **HYBRID / hybrid-v2 / PUBLISHED** |
| Context | **LEGACY / context-v1 / PUBLISHED** |
| Cache | **SHADOW / cache-shadow-v1 / PUBLISHED** |
| Evidence | **evidence-v1 / PUBLISHED** |
| Response Quality + Policy | **response-quality-v2 / VALIDATE_STRICT / PUBLISHED** |
| Prompt | **v1 / 800 / PUBLISHED** |
| Prompt candidato 1200 | **DRAFT** |
| hybrid-v3 | **DRAFT** |
| Re-ranking (`hybrid-rerank-v1`) | **DRAFT** |
| Context BUDGETED | **DRAFT** |
| Vizinhos | **off** |
| Semantic cache (serve) | **off** (SHADOW only) |
| lab-final-TEXT_ONLY / VECTOR_ONLY | **DRAFT** (lab only) |

**Nenhum DRAFT publicado indevidamente.**

---

## 20. Pendências externas

1. **DEPLOY MANUAL LOCAWEB** — publicar `dist/` / `LOCAWEB-FRONTEND-FINAL.zip` em `oftalmocentrointeligente/` e confirmar hash `index-B-Y5fMgf.js`.

Nenhuma outra pendência de desenvolvimento aberta neste encerramento.

---

## 21. Riscos residuais

| Risco | Severidade | Nota |
|-------|------------|------|
| Frontend prod desatualizado | Operacional | Bloqueia UI de auditoria gerencial/tags no domínio até o upload |
| Cache SHADOW com matchedEntries=0 em toggles sem fingerprint | Baixo | Invalidação idempotente; serve permanece 0 |
| Perguntas amplas (“o que é…”) com aviso de resumo | Esperado | Política IMPLICIT_COVERAGE — não é regressão de identificador |
| hybrid-v2 ≠ 100% hit rate | Aceito | 74.4% / MRR 0.621 melhor que v1/v3 na bateria cega |

---

## 22. Arquitetura preservada

```
React → n8n → PostgreSQL → files → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI
```

- Sem nova arquitetura
- Sem novos algoritmos de IA
- Sem novas versões candidatas publicadas
- Gate `documents.is_active` + Qdrant `isActive` mantidos como controles centrais

---

## Critério de encerramento — checklist

- [x] Documento inativo bloqueado em TEXT_ONLY / VECTOR_ONLY / HYBRID / HYBRID_RERANK
- [x] Identificadores exatos sem regressão crítica
- [x] WORKFLOW_HISTORY_SYNC = PASS
- [x] Build final verde
- [x] Auditoria gerencial correta (apresentação)
- [x] hybrid-v2 validado e PUBLISHED
- [x] Nenhum DRAFT publicado indevidamente
- [x] Deploy Locaweb = pendência externa (não falha de desenvolvimento)

**Status final:** ENCERRAMENTO OPERACIONAL DO DESENVOLVIMENTO CONCLUÍDO.
