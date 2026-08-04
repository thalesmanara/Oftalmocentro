# Plano de Contingência — Oftalmocentro Inteligente

Comportamento esperado sob falha. Sem instalação de serviços extras.

## Queda PostgreSQL

- Sintoma: login/API falham; health PostgreSQL vermelho.
- Impacto: sistema indisponível (fonte da verdade).
- Ação: restaurar VPS/serviço Postgres; aplicar backup mais recente; validar health; smoke login + documentos.
- Degradação: não há modo offline.

## Queda OpenAI

- Sintoma: Consulta IA / embeddings falham; OCR/tabular podem seguir.
- Impacto: novas consultas e novos embeddings indisponíveis.
- Ação: verificar status OpenAI; retries nos workflows; comunicar clínica.
- Degradação: documentos já indexados permanecem; upload pode ficar PENDING em embeddings.

## Queda OCR

- Sintoma: PDFs imagem em MANUAL_REVIEW/FAILED.
- Impacto: documentos escaneados não entram na Consulta IA até reprocessar.
- Ação: reprocessar OCR; revisão manual se necessário.
- Degradação: PDFs textuais e planilhas podem seguir.

## Queda Qdrant

- Sintoma: sync FAILED; retrieval vetorial degradado.
- Impacto: Consulta IA deve continuar com fallback híbrido/lexical conforme configuração publicada — **não deve derrubar** a API.
- Ação: reiniciar Qdrant; reindex administrativo se necessário.
- Degradação: qualidade de retrieval pode cair; política/quality seguem ativas.

## Queda VPS / Docker / Coolify

- Sintoma: indisponibilidade total do front/n8n.
- Ação: restore VPS; subir stacks; validar DNS/TLS; smoke completo.
- Comunicação: mensagem institucional de manutenção.

## Queda de disco

- Sintoma: upload/backup falham; logs de ENOSPC.
- Ação: liberar espaço; verificar retenção de backups/artefatos; validar uploads.
- Prioridade: preservar PostgreSQL e volume de documentos.

## Queda de internet (clínica)

- Sintoma: SPA sem API.
- Ação: orientar uso local de arquivos oficiais; retomar ao restabelecer.
- Sem modo offline local.

## Ordem de recuperação sugerida

1. Infra (VPS/disco/rede)
2. PostgreSQL
3. n8n
4. Qdrant
5. React/front
6. Smoke: login → documentos → consulta IA → health → backup status
