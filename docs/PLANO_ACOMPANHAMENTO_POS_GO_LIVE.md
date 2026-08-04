# Plano de Acompanhamento Pós–Go Live

## Primeiras 24 horas

- [ ] Health a cada 2–4 h
- [ ] Erros n8n / executions falhas
- [ ] Login e Consulta IA amostral
- [ ] Uploads e filas OCR/embeddings
- [ ] Disco / RAM no Coolify
- [ ] Backup local diário executou

## Primeiros 7 dias

- [ ] Dataset amostral (subset)
- [ ] Policy: declines/abstains sem leak
- [ ] Auditoria amostral LGPD
- [ ] OCR / Qdrant sync
- [ ] Latência Consulta IA
- [ ] Feedback da clínica
- [ ] Registro de incidentes

## Primeiros 30 dias

- [ ] Backup + ensaio de restore amostral (idealmente isolado)
- [ ] Avaliar destino externo (S3/R2)
- [ ] Índice / performance `documents`
- [ ] Revisar drafts (rerank / BUDGETED) — **sem publicar** sem A/B
- [ ] Cache SHADOW métricas
- [ ] Custo OpenAI

## Contatos

| Papel | Contato |
|-------|--------|
| Suporte técnico | (preencher) |
| Administrador clínica | (preencher) |
| Plantão 24h | (preencher) |

## Escalation

1. Incidente de login / perda documental → prioridade máxima  
2. IA com vazamento → desativar Consulta IA + investigar  
3. Disco cheio → limpeza controlada + backup  
4. Qdrant down → confirmar fallback + reindex em janela  
