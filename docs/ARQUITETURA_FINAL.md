# Arquitetura Final — Oftalmocentro Inteligente

## Fluxo

```
React (SPA)
  → n8n (webhooks autenticados)
    → PostgreSQL (fonte da verdade)
    → Qdrant (vetores / retrieval)
    → OpenAI (embeddings + geração)
    → Arquivos (documentos no storage)
```

Sem Redis. Sem backend Node adicional. Sem novos microsserviços.

## Camadas de IA (estado produtivo)

| Camada | Modo / Versão | Status |
|--------|---------------|--------|
| Retrieval | HYBRID / hybrid-v1 | PUBLISHED |
| Contexto | LEGACY / context-v1 | PUBLISHED |
| Cache | SHADOW / cache-shadow-v1 | PUBLISHED (não serve) |
| Evidence | evidence-v1 | PUBLISHED |
| Response Quality + Policy | VALIDATE_STRICT / response-quality-v2 | PUBLISHED |
| Re-ranking | hybrid-rerank-v1 | DRAFT |
| Contexto BUDGETED | context-budget-v1 | DRAFT |

## Pipeline Consulta IA

```
Auth → Classificação/Retrieval → Evidências → Contexto → Prompt
  → OpenAI → VALIDAR RESPOSTA → APLICAR POLÍTICA → SALVAR CACHE → Resposta
```

## Segurança

- Bearer JWT + permissões
- Request ID em todas as chamadas
- Auditoria de ações
- Política de resposta: DECLINE/ABSTAIN/WARNING/LIMITATION
- Upload: validação mime/extensão/tamanho no backend (+ checks no client)

## Observabilidade

- Health (`/webhook/system/health`)
- Audit logs
- Dataset / métricas de lab
- Request ID / duração nas respostas

## Continuidade

- BACKUP - BANCO / DOCUMENTOS / ORQUESTRAR
- Documentação operacional e técnica em `docs/`
