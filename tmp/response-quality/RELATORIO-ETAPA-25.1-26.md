# RELATÓRIO — Etapa 25.1 + Etapa 26

Validação da Política de Resposta, publicação controlada e fechamento operacional da interface.

Data: 2026-08-03/04  
A/B: `tmp/response-quality/_e251-ab-report.json`  
Publish: `tmp/response-quality/_e251-publish.json`  
Build React: **OK**

---

### 1. Estado inicial

- RQ **response-quality-v1** PUBLISHED, `responsePolicy.enabled=false` (passthrough)
- **response-quality-v2** DRAFT, `enabled=true`
- Pipeline: OpenAI → Quality → Policy → Cache
- Cache SHADOW; retrieval/context/evidence publicados; rerank/BUDGETED DRAFT

### 2. Baseline

- Helpers + live consulta com `policyMeta` em passthrough
- Smoke Etapa 25 (46/46) previamente verde
- UI: menus técnicos misturados em “SISTEMA”; Dashboard dependia de users/categories com degradação parcial

### 3. Runs A/B

- Braço A: v1 (policy off) — 25 casos representativos + live
- Braço B: v2 (policy on) — mesmos casos + override lab `responseQualityConfigVersionId`
- Artefatos: `_e251-ab-report.json`, `_e251-ab-rows.json`

### 4. Resultado v1 × v2

| Métrica | v1 | v2 |
|---------|----|----|
| Strategy Accuracy | 0.40 | **1.00** |
| Injection blocking | 0 | **1** |
| Unsupported action | 0 | **1** |
| False decline | 0 | **0** |
| Critical failures | 11 | **0** |
| Live normal | ANSWER passthrough | **ANSWER** enabled |
| Live injection | ANSWER | **DECLINE** |
| Live ação | ANSWER | **DECLINE** |
| SHADOW serve | não | não |

**Veredito: IMPROVED** · **recommendPublish: true**

### 5. Estratégias testadas

ANSWER, ANSWER_WITH_WARNING, ANSWER_WITH_LIMITATION, REQUEST_CLARIFICATION, ABSTAIN, DECLINE — todas com match esperado no braço B.

### 6. Regressões

Nenhuma regressão crítica no A/B corrigido.  
Nota: live “documento inexistente” ainda pode retornar recusa textual do modelo com fontes de retrieval fraco — fora do escopo de re-ranking nesta etapa.

### 7. Casos críticos

Injection, segredo, ação, insufficient, conflito, valor/código (offline), fonte removida: **PASS** sob v2.

### 8. Decisão de publicação

Publicar **response-quality-v2** — critérios cumpridos (injection/action 100%, false decline 0, críticos ok, live ANSWER preservado, SHADOW ok).

### 9. Publicação realizada

Sim.

1. Arquivou v1  
2. Publicou v2 (`VALIDATE_STRICT`)  
3. Secrets: `response_quality_active_version=response-quality-v2`, mode `VALIDATE_STRICT`  
4. Uma única PUBLISHED  

### 10. Rollback

Testado: v2 → v1 (secrets VALIDATE / v1) → republicação final v2. Ciclo OK.

### 11. Versão final Response Quality

**response-quality-v2 / VALIDATE_STRICT / PUBLISHED**  
`responsePolicy.enabled=true`  
Health: `policyEnabled=true`

### 12. Perfis definidos (por permissão)

1. **OPERAÇÃO** — dashboard, documentos, upload, consulta IA, conta  
2. **ADMINISTRAÇÃO** — usuários, setores, categorias, configurações, auditoria  
3. **ADMINISTRAÇÃO TÉCNICA** — validação/prompts/retrieval/contexto/cache/evidências/qualidade/Qdrant/health/backups  

### 13. Matriz de menus

Sidebar reorganizada em três seções; itens filtrados por permissão; **seção vazia ocultada**.

### 14. Rotas protegidas

`ProtectedRoute` agora exibe **Acesso negado** (403 UX) em vez de redirecionar silenciosamente ao dashboard. Menu oculto ≠ segurança (rotas seguem gated).

### 15. Dashboard

Operacional: cards documentais, atalhos upload/consulta, **sem** depender de `/users`. Widgets degradam com aviso; falha total só se documentos essenciais falharem para quem tem permissão.

### 16. Documentos

Labels operacionais para sync Qdrant (`Falha na indexação para consulta`). Fluxos existentes preservados.

### 17. Consulta IA

Continua sem `*Meta` técnicos. `aria-live` em loading/erro; mensagem de fontes vazia ajustada (DECLINE/ABSTAIN).

### 18. Mensagens

`apiError.ts`: 401/403/FILE_TOO_LARGE/PASSWORD/OCR_MANUAL_REVIEW/INTERNAL_ERROR + requestId.

### 19. Responsividade

Sidebar fixa existente; tabelas/overflow mantidos; build OK. Prioridade desktop/notebook preservada.

### 20. Acessibilidade

Labels/aria em sidebar e consulta; foco via controles nativos; banner técnico com `role="note"`; status `aria-live`.

### 21. Administração técnica

`TechnicalAreaBanner` nas páginas IA, Qdrant e Settings.

### 22. Documentação criada

- `docs/MANUAL_OPERACIONAL.md`
- `docs/MANUAL_ADMINISTRADOR.md`
- `docs/OPERACAO_TECNICA.md`

### 23. Health

`policyEnabled=true`, `activeVersion=response-quality-v2`.

### 24. Auditoria

Ações `AI_RESPONSE_POLICY_*` (Etapa 25). Publicação: tentativa de log (request_id obrigatório — registro parcial via secrets/status). Estratégias não gravam resposta integral.

### 25. Backup

Tabelas RQ no `BACKUP - BANCO`. UX não criou novas tabelas.

### 26. Testes

A/B 25 casos + live; publish/rollback/republish; DECLINE com **0 fontes**; build; inspeção de versões.

### 27. Build

`npm run build` — sucesso.

### 28. Publicação e sincronização

Consulta IA atualizada (sources clear ABSTAIN/DECLINE) + `workflow_history`. Config RQ publicada no PostgreSQL.

### 29. Riscos restantes

1. Perguntas “inexistentes” com retrieval ruidoso podem ainda devolver texto de abstenção do modelo sem strategy ABSTAIN.  
2. VALIDATE_STRICT pode ser mais sensível em quality — monitorar dataset.  
3. Health/Backups no menu técnico apontam para `/configuracoes` (mesma página).  
4. Hardening/LGPD e homologação formal ainda pendentes (próximas etapas).

### 30. Próximos passos

- Hardening / LGPD  
- Homologação / Go Live  
- Dataset completo em produção sob v2  
- (Opcional) publicar rerank/BUDGETED só após A/B próprio  

### 31. Arquitetura preservada

Sem novas camadas de IA, sem memória conversacional, sem ativar cache serve, sem publicar rerank/BUDGETED, sem novos serviços.

### 32. Estado final das versões

| Camada | Estado |
|--------|--------|
| Retrieval | HYBRID / hybrid-v1 / PUBLISHED |
| Contexto | LEGACY / context-v1 / PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 / PUBLISHED |
| Evidence | evidence-v1 / PUBLISHED |
| Response Quality + Policy | **response-quality-v2 / VALIDATE_STRICT / PUBLISHED** |
| Re-ranking | hybrid-rerank-v1 / DRAFT |
| Contexto BUDGETED | context-budget-v1 / DRAFT |
| Vizinhos | off |
| Semantic cache | desligado |
