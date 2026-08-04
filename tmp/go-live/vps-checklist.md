# VPS / Coolify Checklist — Etapa 28

**Verificado em:** 2026-08-04T13:25–13:35Z via SSH `oftalmocentro` (2.24.89.199)

## Recursos

| Item | Valor | Status |
|------|-------|--------|
| Uptime | 67 days | OK |
| Load | ~1.4 (1 vCPU) | Atenção sob carga de dataset |
| RAM | 3.8 Gi total / ~754 Mi disponível | Atenção |
| Swap | **0B** | Risco residual — considerar swap |
| Disco `/` | 48G, 28% usado | OK |
| Inodes | 9% | OK |
| Timezone host | Etc/UTC | Documentar (backups ~06:00 UTC) |

## Containers (restart `unless-stopped`)

| Container | Status | Portas host |
|-----------|--------|-------------|
| n8n | healthy | **0.0.0.0:5678** (exposto) |
| postgresql | healthy | via proxy **0.0.0.0:5432** |
| qdrant | healthy | **sem publish** (6333/tcp null) |
| ocr | healthy | interno |
| tabular | healthy | interno |
| tika | healthy | interno |
| coolify-proxy | healthy | 80/443 |

## SSL / Domínio

| Item | Status |
|------|--------|
| `https://n8n.oftalmocentrouberaba.cloud` | OK |
| `https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/` | OK (200, HTML) |

## Backups locais

Arquivos em `/home/node/files/` no container n8n (ex.: `oftalmocentro_database_20260804_060057.json`).  
Coolify `/data/coolify/backups` vazio. **Destino externo ausente.**

## Observações

1. Qdrant **não** está em porta pública — OK.
2. n8n `:5678` e Postgres `:5432` públicos — mitigar por firewall/ACL se ainda não restritos.
3. Não reiniciar stacks sem janela.
4. Correção Etapa 28: SyntaxError no dataset runner (`IA - EXECUTAR TESTE`) corrigida e versionada.
