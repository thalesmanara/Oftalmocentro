# Relatório — Etapa 21: Pipeline único `IA - RECUPERAR CONTEXTO`

Data: 2026-08-03  
Objetivo: consolidar a recuperação documental em um único subworkflow oficial, simplificando a Consulta IA para orquestração.

---

## 1. Lógica distribuída encontrada (antes)

Na Consulta IA ativa, a recuperação estava inline (~37 nós), incluindo:

- embedding + HTTP OpenAI
- `QDRANT - BUSCAR`
- SQL textual PostgreSQL
- merge híbrido / boosts / dedupe
- carga de config (após merge)
- re-ranking opcional
- montagem de contexto / fontes / retrievalMeta parcial

Subworkflows já existentes: `IA - CARREGAR RETRIEVAL CONFIG`, `IA - RE-RANQUEAR CANDIDATOS`, `QDRANT - BUSCAR`.

## 2. Duplicações encontradas

- Filtros e scores espalhados entre Consulta e subworkflows
- Montagem de fontes / meta na Consulta
- History do `QDRANT - BUSCAR` estava em **Stub** (`ok:true, hits:[]`) enquanto a entity tinha implementação real — busca vetorial efetiva quebrada em produção até a sincronização

## 3. Arquitetura final do pipeline

```
Consulta IA
  → classificar
  → IA - RECUPERAR CONTEXTO
       → carregar config
       → aplicar modo
       → (vetor?) embed + QDRANT - BUSCAR
       → (texto?) SQL chunks
       → merge / normalização / dedupe
       → (rerank?) IA - RE-RANQUEAR CANDIDATOS
       → diversidade + corte
       → Montar contexto atual
       → auditoria AI_RETRIEVAL_*
       → retorno { context, sources, selectedChunks, retrievalMeta }
  → carregar prompt
  → OpenAI
  → responder
```

## 4. Subworkflows criados

| Nome | ID |
|------|-----|
| **IA - RECUPERAR CONTEXTO** | `bae8872eeb164a27` |

## 5. Subworkflows reutilizados

- `IA - CARREGAR RETRIEVAL CONFIG` (`sClDEVNVS0TGG2uq`)
- `QDRANT - BUSCAR` (`YDnrXjzYUOrZVE6N`) — history dessincronizado corrigido
- `IA - RE-RANQUEAR CANDIDATOS` (`nivEQHAqHWIwP8P8`)
- `AUDITORIA - REGISTRAR` (`jtQvQlqRZ5X5WF9I`)
- `IA - CARREGAR PROMPT ATIVO` (permanece na Consulta)

## 6. Consulta IA antes/depois

| | Antes | Depois |
|--|-------|--------|
| Nós | ~37 | 24 |
| Busca SQL/Qdrant/merge/rerank | inline | removidos |
| Entrada retrieval | — | `IA - RECUPERAR CONTEXTO` |
| Prompt | `$('Montar contexto')` | `$('Aplicar contexto recuperado')` |

## 7. Contrato oficial de entrada

```json
{
  "question": "string",
  "classificationJson": "stringified classification",
  "retrievalConfigVersionId": "uuid|''",
  "modeOverrideAllowed": "true|false",
  "requestId": "string",
  "userId": "string",
  "sessionId": "string"
}
```

Override só vale com `modeOverrideAllowed` explícito **e** permissão (`editar_configuracoes` / master / admin).

## 8. Contrato oficial de candidato (interno)

Campos unificados no merge: `chunkId`, `documentId`, `versionId`, scores (`vectorScore`, `textScore`, `hybridScore`/`mergedScore`, `rerankScore`), metadados documentais, `chunkText`, `chunkKind`, etc.

## 9. Contrato oficial de saída

```json
{
  "context": "...",
  "sources": [ { "documentId", "documentTitle", "sectorName", "categoryName", "subcategoryName", ... } ],
  "selectedChunks": [ /* interno — não vai à API pública */ ],
  "retrievalMeta": { /* ver §10 */ },
  "question": "...",
  "classification": { ... }
}
```

## 10. retrievalMeta final

Campos obrigatórios preenchidos: `mode`, `configCode`, `configVersionId`, `configVersion`, `rankingVersion`, `candidateCount`, `deduplicatedCount`, `rerankedCount`, `selectedCount`, latências (`retrieval`, `vector`, `text`, `merge`, `rerank`, `contextBuild`), `fallbackUsed`, `fallbackReason`, `rankedDocumentIds`, `rankedChunkIds`, `sourceDocumentIds`, `requestId`, + `normalizedQuestion` / `questionHash` (prep. cache).

## 11. Filtros centralizados

SQL textual herda filtros de vigência/ativo/versão; Qdrant aplica `isCurrent` + categoria/subcategoria. Representação canônica no merge.

## 12–13. Busca textual / vetorial

- Textual: nó Postgres dentro de `RECUPERAR` (mesmo SQL da Consulta anterior; agora com `chunkId`)
- Vetorial: `QDRANT - BUSCAR` (stub de history removido)

## 14–17. Merge, dedupe, diversidade, re-ranking

Centralizados em `Merge híbrido` → `Preparar seleção` → `Usar re-ranking?` → `Resolver ranking final` (diversidade `maxChunksPerDocument`). Pesos produção `0.65/0.35` preservados. Rerank opcional com fallback híbrido.

## 18. Fallback

- Vetor vazio + texto ok → `fallbackUsed` + reason `vector_empty_text_fallback`
- Rerank falha → ranking híbrido + `HYBRID_FALLBACK` / `rerank_fallback`
- Qdrant stub corrigido (causa raiz de “vetor sempre vazio”)

## 19. Fontes

Derivadas só dos chunks selecionados; API pública sem `chunkId`/scores/vetores.

## 20–21. Dataset / Top-K

`IA - EXECUTAR TESTE` / Avaliar:

- consome `retrievalMeta.rankedDocumentIds`
- mapeia `candidateCount`, `rerankedCount`, `selectedCount` → `final_context_count`
- grava `retrieval_latency_ms` / `rerank_latency_ms`
- Recall@K, Precision@K, MRR, Hit Rate quando há referência

## 22. Auditoria

Eventos no pipeline: `AI_RETRIEVAL_STARTED` / `SUCCESS` (sem conteúdo integral de chunks).

## 23. Health

Componente agregado `retrievalPipeline` (modo, versão, text/vector/rerank available, fallbacks 7d, avg candidates/selected, last dataset validation), além de `retrieval` / `qdrant` / `embeddings`.

## 24. Backup

Sem mudança destrutiva; configs/versões/métricas já cobertas; sem vetores/contexto integral adicionados.

## 25. React

- `SystemHealth`: label + detalhes `retrievalPipeline`
- tipos `SystemHealth.components.retrievalPipeline`
- UX da Consulta IA inalterada para usuário comum
- Build OK

## 26. Testes (amostra)

| Caso | Resultado |
|------|-----------|
| Planilha / semântica / negativo | HTTP 200, answer + sources + meta |
| Produção HYBRID/hybrid-v1 | confirmado PUBLISHED |
| hybrid-rerank-v1 | permanece DRAFT |
| Override admin → hybrid-rerank-v1 | `HYBRID_FALLBACK` (rerank falhou → híbrido), versão candidata |
| Override sem permissão | permanece hybrid-v1 |
| rankedDocumentIds / rankedChunkIds | preenchidos |
| Sem leak chunkId em sources | OK |
| Consulta sem nós de busca | OK (24 nós) |
| Qdrant history sem Stub | OK |
| Health retrievalPipeline | OK |
| Build | OK |

## 27. Build

`npm run build` — sucesso.

## 28. Publicação e sincronização

Workflows publicados/atualizados; `workflow_entity` ↔ `workflow_history` sincronizados (incl. RECUPERAR, Consulta, Qdrant, Avaliar, Health).

## 29. Baseline antes/depois

- Antes (path errado `/webhook/ai/query`): meta nula
- Depois (`/webhook/consulta-ia`): HYBRID/hybrid-v1, respostas documentais coerentes, meta completa
- Equivalência funcional: planilha de enfermagem e biometria recuperam documentos esperados; produção permanece no mesmo modo/versão

## 30. Riscos restantes

- Reranker candidato ainda falha com frequência → fallback híbrido (esperado enquanto DRAFT)
- `modeOverrideAllowed` depende de permissões no token; lab precisa `editar_configuracoes`
- Montagem de contexto ainda é a atual (pré Context Window Manager)
- Alguns casos negativos ainda trazem fontes “ruído” do ranking textual (comportamento pré-existente)

## 31. Preparação Context Window Manager

Saída já expõe `selectedChunks`, scores e `retrievalMeta` para inserir `IA - GERENCIAR JANELA DE CONTEXTO` entre retrieval e OpenAI sem refazer busca. Nó isolado: **Montar contexto atual**.

## 32. Preparação cache semântico

Interno: `normalizedQuestion`, `questionHash`, mode/version. Sem persistência/consulta nesta etapa.

## 33. Produção

**Confirmado: `HYBRID` / `hybrid-v1` PUBLISHED.**  
**Confirmado: `hybrid-rerank-v1` / `HYBRID_RERANK` DRAFT — não publicado.**

## 34. Arquitetura preservada

Sem novos serviços, sem vizinhos, sem CWM, sem cache semântico, sem mudança de pesos de produção — apenas centralização do retrieval.
