# Checklist Go Live — Oftalmocentro Inteligente

Preenchido na Etapa 28 (2026-08-04). Itens humanos pendentes marcados.

## Pré-requisitos

- [x] Build React (`npm run build` sem erros) — warning de chunk size não bloqueador
- [x] Workflows n8n ativos e `workflow_history` sincronizado (154 / 0 issues)
- [x] Uma única versão PUBLISHED por camada de governança
- [x] Secrets ativos coerentes
- [x] Backup recente com checksum (local PARTIAL/VERIFIED 2026-08-04)
- [x] Health geral sem componente crítico em falha

## Segurança

- [x] Login / logout
- [x] 401
- [x] 403
- [x] Webhooks admin autenticados (users 403 para operacional)
- [x] Injection / jailbreak / revelação recusados (DECLINE)
- [x] Nenhum segredo no frontend (revisão Etapa 27)
- [ ] Upload rejeita extensão inválida / >25 MB / senha — *não retestado com fixture destrutiva nesta sessão; cobrir na janela operacional*

## Funcional

- [x] Acervo PDF/DOCX/XLSX amostral (list/download/versions/tabular)
- [x] OCR statuses presentes (incl. MANUAL_REVIEW)
- [x] Planilha preview
- [x] Consulta IA com fontes / policy
- [x] Dashboard operacional sem `/users`

## Continuidade

- [x] Backup FULL local diário (PARTIAL — inventário + JSON DB + workflows)
- [x] Restore isolado de subset testado (`tmp/go-live/restore-test-report.md`)
- [ ] Destino externo — **AUSENTE** (exige aceite no termo ou implementação)
- [x] Plano de contingência documentado
- [ ] Contatos de suporte preenchidos no plano pós-go-live

## LGPD

- [x] Auditoria amostral sem resposta integral
- [x] Cache SHADOW
- [x] Acesso por permissão
- [ ] Orientação clínica formal registrada

## Assinatura

| Papel | Nome | Data | OK |
|-------|------|------|----|
| Técnico | | | |
| Administrador clínica | | | |
| Homologação | | | |
