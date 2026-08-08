# Operação Técnica — Oftalmocentro Inteligente

Resumo para manutenção. **Sem credenciais.**

## Versões publicadas (estado esperado)

| Camada | Modo / Versão | Status |
|--------|---------------|--------|
| Retrieval | HYBRID / hybrid-v2 | PUBLISHED |
| Contexto | LEGACY / context-v1 | PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 | PUBLISHED (não serve) |
| Evidence | STRUCTURED / evidence-v1 | PUBLISHED |
| Response Quality + Policy | VALIDATE_STRICT / response-quality-v2 | PUBLISHED |
| Re-ranking | hybrid-rerank-v1 | DRAFT |
| Contexto BUDGETED | context-budget-v1 | DRAFT |
| Vizinhos | off | — |
| Semantic cache | desligado | — |

## Drafts existentes

- hybrid-rerank-v1
- context-budget-v1
- hybrid-v1 (ARCHIVED)
- hybrid-v3 (DRAFT — includeVectorOnly sem lexical; A/B 28.3 ficou atrás de hybrid-v2)
- AI_QUERY_MAIN v2 (completude + max_tokens 1200 — permanece DRAFT)
- evidence-v2 (se mantido)
- response-quality-v1 (ARCHIVED após promoção da v2)

## Pós-Go-Live (28.3)

- Gate absoluto `documents.is_active` após merge (todos os modos).
- Qdrant payload `isActive` 100% + filtro obrigatório.
- Auditoria limpa em 2026-08-08T21:36:33Z (início oficial); UI gerencial em `auditLabels.ts` + `AuditPage`.
- Publish/rollback retrieval exige Master/Technical Admin (`TECHNICAL_ADMIN_REQUIRED`).
- Relatório: `tmp/post-go-live/RELATORIO-28-3-FECHAMENTO.md`.
- Deploy frontend: **Locaweb** (não Hostinger). Bundle local `index-B-Y5fMgf.js`.

## Pós-Go-Live (28.1/28.2) — regras operacionais

- Senha nova/alterada: mínimo 8 caracteres (login legado <8 permanece válido).
- `users.is_technical_admin`: acesso à Administração Técnica (Master OU Technical Admin via `requiredTechnicalAdmin` / `canAccessTechnicalAdministration`).
- `documents.is_active`: inativos fora do retrieval (`IA - RECUPERAR CONTEXTO` + filtro Qdrant `isActive`).
- **Documentos expirados:** pesquisáveis na IA com **penalidade de ranking** (`penalties.expired`); **não** são tratados como inativos. Tags visuais EXPIRADO / VENCE EM BREVE na UI.
- Retrieval publicado: **HYBRID / hybrid-v2** (includeVectorOnly + lexicalExpansion complementar).
- Prompt publicado: **v1 max_tokens=800**. Candidato DRAFT v2 (completude + 1200) sem publish — A/B sem ganho crítico.
- Response Policy: aviso obrigatório quando `isSummarizedResponse=true` (SUMMARY_INTENT / IMPLICIT_COVERAGE / truncamento).
- Relatórios: `tmp/post-go-live/RELATORIO-AJUSTES-POS-GO-LIVE.md`, `tmp/post-go-live/RELATORIO-28-2-CONSOLIDACAO.md`.

## Pipeline Consulta IA

```
OpenAI → VALIDAR RESPOSTA → APLICAR POLÍTICA DE RESPOSTA → SALVAR CACHE → resposta
```

## Health

Componente `responseQuality` inclui `policyEnabled`, distribuição de estratégias e contadores 7d.

## Backups

`BACKUP - BANCO` cobre configs de Response Quality (`ai_response_quality_configs` / `_versions`), lab, auditoria e demais tabelas de app.

## Hardening / continuidade

Ver também:

- `docs/PLANO_CONTINGENCIA.md`
- `docs/CHECKLIST_GO_LIVE.md`
- `docs/ARQUITETURA_FINAL.md`

Timeouts padrão no React: 30s (consulta IA 120s; upload/OCR/processo 120–180s).

## Filas / OCR / Tabular / Embeddings / Qdrant

Monitorar health e status documental. Reprocessar OCR/embeddings apenas com confirmação. Qdrant: painel `/sistema/qdrant`.

## Cache

SHADOW: grava candidato, **não serve** resposta. Invalidar somente quando o procedimento administrativo exigir.

## Dataset

`IA - EXECUTAR DATASET` / `IA - EXECUTAR TESTE` registram métricas de retrieval, contexto, quality e `response_policy_*`.

## Governanças

Todas versionadas (prompt, retrieval, context, cache, evidence, response quality/policy). Publicação sempre manual após validação.

## Checklist periódico

1. Health ok
2. Uma única versão PUBLISHED por camada
3. Secrets ativos coerentes
4. Workflows ativos + `workflow_history`
5. Backup recente
6. Dataset amostral sem regressão crítica

## Troubleshooting inicial

| Sintoma | Checagem |
|---------|----------|
| Policy não aplica | `response_quality_active_version`, status PUBLISHED, `policyEnabled` no health |
| Injection não recusado | política enabled? versão v2? |
| Documento não aparece na IA | OCR/embedding/Qdrant sync |
| 403 em menu | permissão do usuário |
| Dashboard parcial | widget degradado — ver aviso âmbar |

## Manutenção

- Preferir drafts → validar → publicar
- Confirmar impacto antes de rollback/reindex/invalidar
- Não instalar novos serviços nesta fase
