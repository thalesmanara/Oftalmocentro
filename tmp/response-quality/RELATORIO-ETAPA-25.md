# RELATÓRIO — Etapa 25
## Consolidação da Resposta Final e Política de Resposta

Data: 2026-08-03  
Smoke: `tmp/response-quality/e25-smoke.mjs` → **46/46 OK**  
Build React: **OK**

---

### 1. Fluxo encontrado (pré-etapa)

```
OpenAI → IA - VALIDAR RESPOSTA → Aplicar validação resposta
      → IA - SALVAR CACHE → Aplicar cache save → Preparar sucesso → responder
```

Quality validava a resposta; o cache recebia o texto pós-validação sem política de apresentação.

### 2. Fluxo final

```
OpenAI
  → IA - VALIDAR RESPOSTA
  → Aplicar validação resposta
  → IA - APLICAR POLÍTICA DE RESPOSTA
  → Aplicar política resposta
  → IA - SALVAR CACHE          (answer + sources pós-policy)
  → Aplicar cache save         (data.policyMeta no contrato)
  → Preparar sucesso
  → Registrar auditoria sucesso
  → responder
```

### 3. Subworkflow criado

| Campo | Valor |
|-------|--------|
| ID | `c25ResponsePolicy01` |
| Nome | **IA - APLICAR POLÍTICA DE RESPOSTA** |
| Status | active |
| Lógica | `applyResponsePolicy` (determinística, sem LLM) |

Entrada: question, answer, sources, classification, responseMeta, evidenceMeta, contextMeta, retrievalMeta, quality config version, requestId.  
Saída: answer, sources, policyMeta, auditAction.

### 4. Matriz de decisão

Configurável em `configuration.responsePolicy` (thresholds + strategies):

| Condição | Estratégia |
|----------|------------|
| prompt injection / fora de escopo / ação não suportada | DECLINE |
| insufficientContext / sem fontes + POOR/vazio | ABSTAIN |
| ambiguidade real com ≥2 opções identificadas | REQUEST_CLARIFICATION |
| conflictDetected (confirmed/potential) | ANSWER_WITH_WARNING |
| grade LOW/POOR ou confidence LOW / baixa cobertura | ANSWER_WITH_LIMITATION (ou ABSTAIN se sem fontes) |
| demais casos válidos | ANSWER |

Prioridade: DECLINE → ABSTAIN → CLARIFY → WARNING → LIMITATION → ANSWER.

### 5. Estratégias

`ANSWER` · `ANSWER_WITH_WARNING` · `ANSWER_WITH_LIMITATION` · `REQUEST_CLARIFICATION` · `ABSTAIN` · `DECLINE`

### 6. Linguagem oficial

Frases em `responsePolicy.phrases` (v2 DRAFT / defaults):

- Abstenção: “Não foi localizada documentação interna suficiente para responder com segurança.”
- Limitação: “Os documentos disponíveis permitem uma resposta parcial:”
- Conflito: “Há divergência entre os documentos disponíveis. A informação mais recente indica:”
- Clarificação: “Para consultar a documentação correta, preciso que você especifique:”
- Recusa: “Esta solicitação não pode ser respondida com base na documentação interna disponível.”

`forbiddenExpressions`: acho, imagino, provavelmente, talvez, segundo meu conhecimento, etc.

### 7. Tratamento de conflitos

Consome `conflictDetected`, `conflictType`, `preferredDocumentId` / preferredEvidence já calculados (Evidence/Quality).  
Não reexecuta detecção. Emite `ANSWER_WITH_WARNING` com prefixo institucional.

### 8. Contexto insuficiente

`contextMeta.insufficientContext` / fallback / ausência documental → **ABSTAIN** (quando policy enabled).

### 9. Baixa confiança

`confidence=LOW`, grade LOW/POOR ou cobertura abaixo do threshold → **ANSWER_WITH_LIMITATION** (com fontes) ou **ABSTAIN** (sem fontes).

### 10. Clarificação

Somente se classificação/retrieval indicar ambiguidade **e** existirem ≥2 opções reais (alternatives, categorias/subcategorias das fontes). Não inventa opções.

### 11. Decline

Heurísticas determinísticas: injection/secrets, fora de escopo, ações não suportadas (`detectDecline`).

### 12. Fontes

- ANSWER / WARNING / LIMITATION: preserva e deduplica por documento.
- ABSTAIN / DECLINE: sem fontes públicas fracas.
- Não expõe chunk, vetor, path, score interno ou configuração.

### 13. Integração com Response Quality

Política é campo aninhado `responsePolicy` da configuração RQ (sem governança paralela).  
Runtime: após `IA - VALIDAR RESPOSTA`, antes do cache.  
Validador central rejeita estratégias arbitrárias, frases vazias, segredos e expressões executáveis.

### 14. Integração com Cache

- `IA - SALVAR CACHE` usa `answer` e `sourcesJson` de **Aplicar política resposta**.
- SHADOW continua sem servir (`servedFromCache !== true` no smoke).
- `Aplicar cache save` inclui `policyMeta` no `data` público.
- Elegibilidade de cache (conflito / insufficient / etc.) permanece nas regras do cache; ABSTAIN/DECLINE não são “boas” para cache sob a política atual de não cachear respostas problemáticas.

### 15. Configuração

| Versão | Status | Policy |
|--------|--------|--------|
| `response-quality-v1` | **PUBLISHED** | `enabled: false` (passthrough compatível + `policyMeta`) |
| `response-quality-v2` | **DRAFT** | `enabled: true` (matriz completa) |

**v2 não foi publicada automaticamente.**

Migration lab: `tmp/response-quality/migration-25.sql` (colunas `response_policy_*` em `ai_test_results` / taxas em `ai_test_metrics`). Sem tabelas `ai_response_policy_*`.

### 16. React

- Página existente `/ia/qualidade` (`AiResponseQualityPage.tsx`).
- Seção **Política de Resposta**: estratégias, frases, thresholds, enabled.
- Tipos em `aiResponseQualityService.ts` (`AiResponsePolicyConfiguration`).
- Health UI: `policyEnabled`, warnings/abstentions/declines 7d.
- **Não** criada `/ia/politicas`.

### 17. Dataset

- Colunas registráveis em `ai_test_results` + taxas em `ai_test_metrics`.
- `IA - EXECUTAR TESTE` (`Avaliar e montar insert`) grava `policyMeta` → `response_policy_*`.
- `IA - CALCULAR MÉTRICAS` agrega warning/limitation/clarification/abstention/decline/conflict explanation/low-confidence rates + latência média.

### 18. Health

Componente existente `responseQuality` evoluiu com:

`policyEnabled`, `strategyDistribution7d`, `warnings7d`, `limitations7d`, `clarifications7d`, `abstentions7d`, `declines7d`, `policyFailures7d`, `averagePolicyLatencyMs`

(agregados 7d a partir de lab + audit).

### 19. Auditoria

`Registrar auditoria sucesso` passa a emitir:

- `AI_RESPONSE_POLICY_APPLIED`
- `AI_RESPONSE_POLICY_WARNING`
- `AI_RESPONSE_POLICY_LIMITATION`
- `AI_RESPONSE_POLICY_CLARIFICATION`
- `AI_RESPONSE_POLICY_DECLINE`
- `AI_RESPONSE_POLICY_ABSTAIN`

Metadata: strategy, reasonCodes, warning, answerModified, configVersion, latency — **sem** resposta integral, pergunta, chunks, prompt ou vetores.

### 20. Backup

`BACKUP - BANCO` exporta `ai_response_quality_configs` e `ai_response_quality_config_versions`. Nenhuma tabela nova de policy.

### 21. Testes

Smoke `e25-smoke.mjs`: **46/46**

Cobertura: estratégias 1–7, OCR, planilha, expirado, fonte removida, baixa confiança, POOR/EXCELLENT, negativa fundamentada, injection, fontes, cache pós-policy, SHADOW, validate, health, admin, 401, workflows, history, backup, auditoria, labels produtivos, contrato público.

### 22. Build

`npm run build` — **sucesso** (tsc + vite).

### 23. Publicação e sincronização

- Workflows atualizados com `workflow_history` + `activeVersionId` + toggle active.
- Policy WF, Consulta IA, validate admin, health, dataset teste, métricas, backup.

### 24. Riscos restantes

1. **v1 com `enabled:false`**: em produção a política não altera texto (passthrough). DECLINE/ABSTAIN “fortes” só após publicar v2 (manual).
2. Agregados health 7d dependem de runs de dataset/audit com colunas preenchidas; até lá contadores podem ser 0.
3. Injection live sob v1 ainda retorna `ANSWER` + `POLICY_DISABLED_PASSTHROUGH` (esperado); a matriz completa está em v2 DRAFT.
4. `auditAction` extra em Preparar sucesso é ignorado pelo subworkflow (campos conhecidos apenas); a auditoria lê a política diretamente.

### 25. Confirmação de arquitetura preservada

| Camada | Estado |
|--------|--------|
| Retrieval | HYBRID / hybrid-v1 / PUBLISHED |
| Context | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | evidence-v1 / PUBLISHED |
| Response Quality | response-quality-v1 / PUBLISHED |
| Re-rank / Context BUDGETED | DRAFT (inalterados) |
| OCR / Qdrant / prompts / documentos | **não alterados** |
| Governança paralela de policy | **não criada** |
| Página `/ia/politicas` | **não criada** |

A política consolida a Response Quality Layer via `responsePolicy`, posicionada após validação e antes do cache.
