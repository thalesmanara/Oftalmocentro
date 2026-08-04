# Termo de Aceite — Oftalmocentro Inteligente

**Não assinado automaticamente.** Preencher após homologação.

## Sistema

Oftalmocentro Inteligente — Consulta documental com IA.

## Homologação técnica (Etapa 28)

| Item | Resultado |
|------|-----------|
| Decisão técnica | **GO CONDICIONAL** |
| Dataset final | 100 casos · PASS 83 · FAIL 17 · ERROR 0 · score 87.30 · 0 alucinações |
| Auth / policy crítica | OK (smoke 20/20) |
| Restore isolado (subset) | OK — contagens matched |
| Backup externo | **AUSENTE** |
| DR completo | **Não reivindicado** |
| Build React | OK (`dist/` gerado; asset local ≠ publicado — sincronizar Hostinger) |

## Estado homologado (versões)

| Camada | Versão | Status |
|--------|--------|--------|
| Retrieval | hybrid-v1 / HYBRID | PUBLISHED |
| Contexto | context-v1 / LEGACY | PUBLISHED |
| Cache | cache-shadow-v1 / SHADOW | PUBLISHED |
| Evidence | evidence-v1 | PUBLISHED |
| Response Quality + Policy | response-quality-v2 / VALIDATE_STRICT | PUBLISHED |
| Re-ranking | hybrid-rerank-v1 | DRAFT |
| Contexto BUDGETED | context-budget-v1 | DRAFT |

## Riscos formalmente apresentados

1. **Backup externo ausente** (somente backup local operacional).
2. Restore full `pg_dump` de todo o schema n8n não ensaiado (subset isolado **foi** testado).
3. Disaster recovery **completo** ainda não reivindicável (binários não empacotados no backup FULL).
4. Seq scans em `documents` sob crescimento.
5. Bundle React ~520 KB; swap VPS = 0; portas 5678/5432 públicas a revisar.
6. Publicação do `dist/` mais recente no Hostinger pendente se ainda não enviada.

## Declaração do responsável

Declaro ter sido informado dos riscos acima e:

- [ ] **ACEITO** o Go Live com os riscos residuais de continuidade (backup externo / DR).
- [ ] **NÃO ACEITO** — Go Live bloqueado até backup externo + política de continuidade.

Nome: _______________________________  
Cargo: _______________________________  
Data: ____/____/________  
Assinatura: _______________________________

## Validação técnica (equipe)

- Homologação: `docs/RELATORIO_HOMOLOGACAO.md` — [x] Sim  
- Smoke auth/IA/health — [x] OK  
- Dataset final registrado — [x] Sim  
- Deploy React Hostinger — [ ] Pendente sync `dist/`
