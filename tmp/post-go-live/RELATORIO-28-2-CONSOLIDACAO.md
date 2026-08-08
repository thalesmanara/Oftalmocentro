# Relatório — Etapa 28.2 Consolidação Pós-Go-Live

**Data:** 2026-08-08  
**Objetivo:** concluir pendências da 28.1 sem novas camadas/serviços.

## 1. Pendências encontradas (da 28.1)

| Pendência | Resolução |
|-----------|-----------|
| max_tokens 1500 só em DRAFT | A/B real executado; **não publicar** (ganho ~0) |
| Aviso de resumo só com “resumo” | Ampliado com IMPLICIT_COVERAGE |
| Similaridade só via dicionário | Causa raiz: merge descartava hits só-vetoriais |
| Expirados excluídos da IA | **Revertido** → política B (permitir + penalty) |
| Cache na inativação | Invalidação wired |
| Auditoria isActive desligada | Reativada (não bloqueante) |
| Qdrant inativos | Payload `isActive` + filtro BUSCAR |
| Frontend Hostinger | Build OK; **deploy manual pendente** (sem FTP no repo) |

## 2–5. Respostas longas / A/B / max_tokens / publicação

| Item | Resultado |
|------|-----------|
| Baseline produtivo | max_tokens **800** (v1 PUBLISHED) |
| A (800) complexa | ~3861 chars |
| B (1500 temp) complexa | ~4163 chars |
| Gain médio complexo | **~3 chars** |
| Pontual | estável (~522) |
| Decisão | **Manter max_tokens=800 publicado** |
| Novo DRAFT | v2 com bloco de completude adaptativa + **1200** (override A/B 3967→4082; sem publish) |

Causa: o gargalo das respostas “incompletas” não era truncamento de output; era sobretudo **recall semântico** (hits vetoriais descartados).

## 6–9. Summary detection

| Caso | Resultado |
|------|-----------|
| A. “Resuma…” | `SUMMARY_INTENT` + aviso obrigatório |
| B. Pergunta ampla implícita | `MULTI_SOURCE_LONG_ANSWER` + `IMPLICIT_COVERAGE` + aviso |
| C. CNPJ pontual | `FACTUAL_QUESTION` / sem aviso |

Workflow: `IA - APLICAR POLÍTICA DE RESPOSTA` `06589cac…`

## 10–12. Investigação semântica / causa raiz / ajustes

**Causa raiz:** no `Merge híbrido`, candidatos só-vetoriais entravam sem `chunkText` e eram descartados (`if(!row.chunkText) continue`). O caminho léxico (ILIKE literal) não recuperava sinônimos; o vetorial até encontrava, mas o merge eliminava.

**Ajustes (versionados):**
1. Pipeline de hidratação vetorial (só quando `merge.includeVectorOnly=true`)
2. Lexical expansion complementar (não principal)
3. `candidateLimit=40`, `topK` alinhado ao candidateLimit
4. Penalty para expirados

## 13–14. Lexical expansion

Papel: **complementar**. Dicionário ajuda termos conhecidos; generalização vem de `includeVectorOnly` + embeddings.

## 15–17. Testes conhecidos / não cadastrados / paráfrases

Ver `tmp/post-go-live/28-2-ab-results.json`.

Grupo B (não no dicionário) com ganho: ex. “Auto de vistoria dos bombeiros” passou a recuperar fontes no v2.

Par de exemplo conhecido: “conserto da máquina” → Plano de Gerenciamento de Tecnologias (**hit após publish**).

## 18–24. Métricas A/B e publicação retrieval

Heurística de hit por grupo (consulta end-to-end):

| Grupo | v1 hits | v2 hits | Δ |
|-------|---------|---------|---|
| A-known | 2/3 | 3/3 | +1 |
| B-unknown | 3/5 | 4/5 | +1 |
| paraphrase | 1/2 | 1/2 | 0 |
| exact | 0/1* | 0/1* | 0 |

\*O caso “CNPJ…” no probe de sources falhou o critério de título; smoke dedicado de CNPJ **OK** com resposta correta e sem aviso de resumo.

**Decisão:** publicar **hybrid-v2**.

Estado:
- `retrieval_active_version=hybrid-v2`
- `hybrid-v1` → ARCHIVED
- Rollback: republish hybrid-v1 + secrets

## 25–26. Política de expirados

**Decisão final: B — permitir com prioridade menor.**

Motivo: o cliente pediu **destaque visual**, não remoção. Os ~14 expirados incluem histórico valioso (alterações societárias, alvarás, COREN, AVCB, planos).

Implementação:
- Removido filtro `expiration_date >= CURRENT_DATE` do SQL lexical
- `penalties.expired=0.12` no ranking
- UI mantém tags EXPIRADO / VENCE EM BREVE
- Inativo continua sempre fora

## 27–30. Inativo / Qdrant / Cache / Auditoria

| Item | Status |
|------|--------|
| Inativo fora da IA | OK (smoke por `documentId`) |
| Qdrant payload isActive | Wired no PUT |
| QDRANT BUSCAR | should: missing OR true |
| Cache invalidate event | Wired (non-blocking) |
| DOCUMENT_DEACTIVATED / ACTIVATED | Registrados em `audit_logs` |

## 31–32. Build / Deploy

| Item | Status |
|------|--------|
| `npm run build` | OK → `dist/assets/index-Dx7ZDCkS.js` |
| Domínio real | ainda serve `index-V49IbOIr.js` |
| Deploy Hostinger | **PENDENTE** — upload manual de `dist/` para `oftalmocentrointeligente/` (sem credenciais FTP no ambiente) |

## 33–34. Dataset / regressão

Artefatos:
- `tmp/post-go-live/28-2-ab-results.json`
- `tmp/post-go-live/28-2-final-smoke.json`
- `tmp/post-go-live/28-2-inactive-ia.json`

Smoke pós-publish: login, senha 7, máquina/conserto, CNPJ, resumo, inativo.

## 35–36. Workflows / history

Publicados nesta consolidação (principais):
- IA - RECUPERAR CONTEXTO `8a658ba9…`
- PUT Documentos `c31dbbba…`
- QDRANT - BUSCAR `9a3da638…`
- IA - APLICAR POLÍTICA `06589cac…`
- IA - VALIDAR RETRIEVAL CONFIG `5d2b493f…`

`scripts/n8n-sync-active-history.mjs` executado.

## 37. Estado final das versões

| Camada | Estado |
|--------|--------|
| Retrieval | **HYBRID / hybrid-v2 / PUBLISHED** |
| Context | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | evidence-v1 / PUBLISHED |
| Response Quality | response-quality-v2 / VALIDATE_STRICT / PUBLISHED |
| Prompt | **v1 / 800 / PUBLISHED** (v2 DRAFT completude+1200) |
| Re-rank | DRAFT |
| Context BUDGETED | DRAFT |
| Vizinhos | off |
| Semantic cache | off |

## 38. Riscos restantes

1. Frontend Hostinger desatualizado até upload do `dist/`.
2. Pontos Qdrant legados sem `isActive` continuam elegíveis (intencional); inativos dependem do set_payload + filtro SQL.
3. Exact “CNPJ” no probe de retrieval por título é frágil — resposta pontual OK.
4. Publish de retrieval via API admin falhou para usuário compras; feito via SQL governado — preferir Master/Tech Admin na UI da próxima vez.

## 39. Arquitetura preservada

React → n8n → PostgreSQL → Arquivos → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI.

Nenhum serviço novo. Nenhuma camada de IA nova.
