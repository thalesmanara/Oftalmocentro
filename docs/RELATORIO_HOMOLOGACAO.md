# Relatório de Homologação — Etapa 28

**Sistema:** Oftalmocentro Inteligente  
**Data da homologação técnica:** 2026-08-04  
**Decisão:** ver seção GO/NO-GO (final).

## 1. Estado inicial

Registrado em `tmp/go-live/estado-inicial.json`.

Versões ativas confirmadas:

| Camada | Versão | Status |
|--------|--------|--------|
| Retrieval | hybrid-v1 / HYBRID | PUBLISHED |
| Contexto | context-v1 / LEGACY | PUBLISHED |
| Cache | cache-shadow-v1 / SHADOW | PUBLISHED |
| Evidence | evidence-v1 | PUBLISHED |
| Response Quality + Policy | response-quality-v2 / VALIDATE_STRICT | PUBLISHED |
| Re-ranking | hybrid-rerank-v1 | DRAFT |
| Contexto BUDGETED | context-budget-v1 | DRAFT |

Arquitetura preservada: React → n8n → PostgreSQL → Arquivos → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI.

## 2. Inventário final

- Workflows ativos: **154**, `workflow_history` sync **0 issues** (`tmp/go-live/workflows-final.json`)
- Webhooks: 102
- Secrets coerentes com versões publicadas
- Vizinhos: off · Semantic cache: off

## 3–4. Autenticação e permissões

Smoke `tmp/go-live/homolog-smoke.json`: **20/20 OK** (login, senha inválida, 401, token adulterado, sessão, logout, 403 users).

Matriz: `docs/MATRIZ_PERMISSOES_FINAL.md`.

## 5–7. Documentos / OCR / Planilhas

Amostra em produção sem upload destrutivo (`tmp/go-live/documents-e2e-sample.json`):

- 57 documentos listados; 52 `processed`; embeddings VALID 53; Qdrant SYNCED na amostra
- Download 200, versions 200, tabular preview 200
- OCR: NOT_REQUIRED dominante; 1 MANUAL_REVIEW
- 1 planilha (xlsx) com preview OK
- Consulta IA (smoke): normal ANSWER; injection/secret/action/fora → DECLINE; `answerFromCache=false`

## 8–9. Consulta IA e Dataset

Smoke IA: OK (policy crítica).  

Dataset final (`tmp/go-live/dataset-final.*`):

| Campo | Valor |
|-------|-------|
| runId | `f2c18773-4121-4feb-97dd-abb61c0494fd` |
| total | **100** |
| PASS | 83 |
| FAIL | 17 (funcionais documentados) |
| ERROR | **0** |
| score | **87.30** |
| alucinações | **0** |
| retrieval | HYBRID / hybrid-v1 |

Correção bloqueadora: SyntaxError no nó **Avaliar e montar insert** (`IA - EXECUTAR TESTE`), versionId `16b5ffbc-7d2e-42de-b1e2-a005915f5681`.

## 10. Cache SHADOW

Confirmado: SHADOW / cache-shadow-v1 / PUBLISHED; respostas não servidas (`answerFromCache=false`).

## 11. Qdrant

Health OK; portas 6333/6334 **sem publish** no host; dimensão/coleção conforme operação anterior.

## 12–13. Performance / concorrência

`tmp/go-live/performance-final.json`:

- Health p50 ~940 ms · Documents p50 ~430 ms · Consulta IA p50 ~7550 ms
- Concorrência 5: 5/5 OK, avg ~13.2 s
- Limite sugerido: máx. 5 Consulta IA simultâneas (1 vCPU)

## 14–15. Backup / Restore

- Backups locais diários PARTIAL/VERIFIED em `/home/node/files/`
- **Backup externo: AUSENTE**
- Restore isolado de subset (`pg_dump`/`pg_restore` → `n8n_restore_e28`): contagens matched (documents 58, users 5, cases 100, secrets 64, backup_runs 24) — `tmp/go-live/restore-test-report.md`
- DR completo: **não reivindicado**

## 16–17. VPS / Containers

`tmp/go-live/vps-checklist.md`: uptime 67d, disco 28%, Qdrant interno OK, swap 0, RAM apertada, n8n:5678 e PG:5432 públicos (mitigar).

## 18–19. React / Deploy

- `npm run build` OK (chunk ~521 KB — warning não bloqueador)
- Domínio público `…/oftalmocentrointeligente/` → HTTP 200
- Build local `dist/` OK; **asset publicado** `index-B-YoXynq.js` ≠ local `index-BzbNexHr.js` → **enviar `dist/` ao Hostinger** antes do go-live oficial

## 20–21. n8n / Health

Workflows OK; health essenciais OK no smoke; policy enabled VALIDATE_STRICT.

## 22–23. Auditoria / LGPD

Amostra smoke: sem resposta integral / tokens / senhas na auditoria amostrada.

## 24–26. Documentação / Treinamento / Aceite

- Manuais e planos revisados (Etapa 27+)
- `docs/TERMO_ACEITE.md` — **não assinado automaticamente**
- `docs/PLANO_ACOMPANHAMENTO_POS_GO_LIVE.md`

## 27. Riscos residuais

1. Backup externo ausente  
2. Binários não no backup FULL  
3. Swap zero / RAM limitada  
4. Portas 5678/5432 expostas  
5. Seq scans `documents` com crescimento  
6. Bundle React grande  
7. Drafts (rerank / BUDGETED) não publicados (intencional)

## 28. Bloqueadores corrigidos nesta etapa

- SyntaxError no runner do dataset (bloqueava consolidação de resultados) — **corrigido e retestado parcialmente; run limpo em andamento/registrado**

## 29. Decisão GO / NO-GO

### **GO CONDICIONAL**

Homologação técnica **aprovada**. Entrada oficial em produção **aguarda**:

1. Assinatura humana em `docs/TERMO_ACEITE.md` (risco de backup externo / DR incompleto).
2. Upload do `dist/` gerado nesta sessão para Hostinger, se o asset publicado divergir do build local.

**Não** é NO-GO: auth, policy crítica, health, workflows, dataset (0 erro estrutural / 0 leak / 0 alucinação) e restore isolado de metadados estão OK.

## 30–33. Go-live / acompanhamento / versões / arquitetura

- Data/hora go-live oficial: *após assinatura do termo*  
- Plano: `docs/PLANO_ACOMPANHAMENTO_POS_GO_LIVE.md`  
- Snapshot: `tmp/go-live/estado-final.json`  
- Versões IA publicadas: **inalteradas** (hybrid-v1, context-v1, cache-shadow-v1, evidence-v1, response-quality-v2)  
- Drafts: hybrid-rerank-v1 e context-budget-v1 **permanecem DRAFT**  
- Arquitetura: preservada · cache **não** serve respostas · sem novas camadas
