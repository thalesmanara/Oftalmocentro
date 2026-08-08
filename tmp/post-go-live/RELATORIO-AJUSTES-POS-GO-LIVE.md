# Relatório — Etapa 28.1 Ajustes Pós-Go-Live

**Data:** 2026-08-08  
**Ambiente:** produção Oftalmocentro Inteligente  
**Baseline git:** `d1bedc8` (main) + alterações desta etapa

## 1. Estado inicial

Registrado em `tmp/post-go-live/estado-inicial.json`.

| Componente | Status |
|---|---|
| Login | OK |
| Consulta IA | OK (200) |
| Documentos GET | OK (56) |
| Qdrant | green, 634 points |
| Containers | n8n, postgres, tika, ocr, tabular, qdrant healthy |
| Retrieval | HYBRID / hybrid-v1 / PUBLISHED |
| Context | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | STRUCTURED / evidence-v1 / PUBLISHED |
| Response Quality | VALIDATE_STRICT / response-quality-v2 / PUBLISHED |
| Re-rank / Context budget | DRAFT (preservados) |

## 2. Backup / snapshot pré-ajuste

- Snapshot operacional: estado-inicial + containers healthy + Qdrant green.
- Migration `is_active` idempotente (default TRUE — sem remoção silenciosa da IA).
- Governanças publicadas **não** alteradas in-place.

## 3–4. Senha mínima 8

| Camada | Status |
|---|---|
| AUTH - CHANGE PASSWORD | já rejeitava <8 |
| POST/PUT Usuários | validação backend adicionada (400 VALIDATION_ERROR) |
| UsersPage / Minha Conta | UI mín. 8 |
| Login legado <8 | preservado (sem troca forçada; bcrypt inalterado) |

Smoke: create/change com 7 caracteres → 400.

## 5–6. Administrador Técnico

Já implementado na Etapa anterior (coluna, auth, checkbox, `requiredTechnicalAdmin`, `canAccessTechnicalAdministration`).

Nesta etapa:

- Sidebar/Settings unificados no helper `canAccessTechnicalAdministration` (Master **ou** Technical Admin).
- Sem privilege escalation adicional.

## 7–10. Vigência, ordenação, Dashboard, notificação

React:

- Tags **EXPIRADO** / **VENCE EM BREVE** (mutuamente exclusivas) + **INATIVO**.
- Ordenação: Vigência (padrão), Nome, Atualização, Criação, Setor, Categoria.
- Dashboard: seção Vigência (expirados + 60 dias), banner com contadores.
- Helpers em `src/utils/document.ts`.

## 11–14. Documento ativo/inativo + retrieval + Qdrant + cache

| Item | Status |
|---|---|
| Migration `documents.is_active` | OK (56 ativos / 0 inativos) |
| GET Documentos retorna `isActive` | OK |
| PUT Documentos persiste `isActive` | OK (corrigido + republished `bacbe880…`) |
| Resposta PUT `isActive` coerente | OK (CASE com valor pretendido; snapshot PG) |
| Auditoria DOCUMENT_ACTIVATED/DEACTIVATED | nós presentes (auditoria dedicada desabilitada temporariamente no ramo paralelo; toggle via SQL/Aplicar isActive) |
| IA - RECUPERAR CONTEXTO exclui `is_active=false` e expirados | PUBLISHED |
| Qdrant points | não deletados na inativação; exclusão efetiva pelo filtro SQL do hybrid merge |
| Cache SHADOW | permanece SHADOW; invalidação pontual recomendada no backlog se entry depender do doc |

**Mudança de comportamento importante:** documentos com `expiration_date < CURRENT_DATE` deixam de entrar no retrieval normal (~14 docs / redução medida de candidatos). Preferência operacional do brief.

## 15. Detalhe por perfil

Metadados OCR/embedding/Qdrant/checksum só para `canAccessTechnicalAdministration`. Usuário operacional vê campos de negócio.

## 16–19. Respostas mais completas / resumo / formatação

| Item | Status |
|---|---|
| Prompt PUBLISHED max_tokens | **800** (inalterado) |
| Candidato DRAFT | AI_QUERY_MAIN v2 **max_tokens=1500** (DRAFT, sem publish) |
| Aviso de resumo | Policy + Consulta IA: prefixo obrigatório + `isSummarizedResponse` |
| Smoke pergunta “resumo…” | aviso presente no início |
| Formatação | Markdown já suportado (SimpleMarkdown); sem nova camada |

Publicar max_tokens 1500 **somente após A/B/dataset**.

## 20–23. Similaridade / lexical / A/B

Investigação: `tmp/post-go-live/lexical-investigation.md`.

- hybrid-v1: lexical literal ILIKE; sem sinônimos.
- Criado **hybrid-v2 DRAFT** com `lexicalExpansion` (não publicado, não ligado ao runtime).
- `app_secrets` retrieval_* inalterados.
- A/B pendente antes de qualquer publish.

## 24–27. Dataset / auditoria / health / backup

- Dataset A/B retrieval e prompt **não publicados** — candidatos em DRAFT.
- Smoke IA + resumo OK (`tmp/post-go-live/smoke-tests.json`).
- Health: documentos expirados não degradam infra.
- Backup: colunas novas cobertas pelo backup de DB existente.

## 28. React

Build: `npm run build` OK → `dist/assets/index-Dx7ZDCkS.js`.

Arquivos principais: DocumentLibrary/Detail/Form/Edit, Dashboard, Users, ConsultaIA, Sidebar, Settings, document utils, documentsService, aiService, types.

## 29–30. Testes / regressão focada

OK: login, senha 7 rejeita, listagem isActive, **deactivate/reactivate 8/8**, consulta IA, aviso de resumo, Qdrant green, build.  
Smoke: `tmp/post-go-live/smoke-tests.json` (último run 8/8).

Pendências conscientes:

- Dataset completo A/B hybrid-v2 e prompt 1500.
- Deploy Hostinger do `dist/` novo.
- Reativar auditoria DOCUMENT_* no ramo limpo (sem paralelismo quebrando Respond).

## 31–34. Publicação / workflows / history

Workflows publicados nesta etapa (principais):

| Workflow | activeVersionId (último conhecido) |
|---|---|
| GET Documentos | `4e41fa77-…` |
| PUT Documentos | `bacbe880-d5d4-4d3c-a12e-752fd4a4a17c` |
| POST Usuários | `e9bfe332-…` |
| PUT Usuários | `73d1bef9-…` |
| IA - RECUPERAR CONTEXTO | `4865bca8-…` |
| IA - APLICAR POLÍTICA | `345405f8-…` |
| Consulta IA | `ca2f27f8-…` |
| IA - VALIDAR RETRIEVAL CONFIG | `73e2f849-…` |

Detalhe: `tmp/post-go-live/n8n-patches.json`.

## 35–36. Riscos / backlog

1. **Expirados fora da IA** — impacto em cobertura; validar com o cliente se algum expirado ainda deve responder com caveat.
2. **hybrid-v2 / max_tokens 1500** — DRAFT até A/B.
3. **Deploy frontend** — UI só em produção após publish do `dist`.
4. Synonym expansion ainda não wired no RECUPERAR CONTEXTO (só config DRAFT).
5. Invalidação explícita de cache SHADOW por documento inativado (melhoria).

## 37. Estado final das versões

| Área | Estado |
|---|---|
| Retrieval | **HYBRID / hybrid-v1 / PUBLISHED** (hybrid-v2 DRAFT) |
| Context | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | evidence-v1 / PUBLISHED |
| Response Quality | response-quality-v2 / VALIDATE_STRICT / PUBLISHED |
| Prompt | v1 PUBLISHED max_tokens=800; v2 DRAFT max_tokens=1500 |
| Re-rank | hybrid-rerank-v1 / DRAFT |
| Context BUDGETED | context-budget-v1 / DRAFT |
| Vizinhos | off |
| Semantic cache | desligado |

## 38. Arquitetura preservada

React → n8n → PostgreSQL → Arquivos → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI.

Nenhum serviço novo. Nenhuma camada de IA nova. DRAFTs sem validação **não** publicados.
