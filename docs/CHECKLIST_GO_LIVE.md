# Checklist Go Live — Oftalmocentro Inteligente

Use este checklist na homologação final antes de liberar a clínica.

## Pré-requisitos

- [ ] Build React publicado (`npm run build` sem erros)
- [ ] Workflows n8n ativos e `workflow_history` sincronizado
- [ ] Uma única versão PUBLISHED por camada de governança
- [ ] Secrets ativos coerentes (retrieval, context, cache, evidence, response quality)
- [ ] Backup recente com checksum válido
- [ ] Health geral sem componente crítico em falha

## Segurança

- [ ] Login / logout funcionando
- [ ] 401 redireciona para login
- [ ] 403 exibe acesso negado
- [ ] Webhooks administrativos exigem autenticação
- [ ] Injection / jailbreak / revelação de prompt recusados pela política
- [ ] Nenhum segredo no frontend
- [ ] Upload rejeita extensão inválida, tamanho > 25 MB e arquivo com senha

## Funcional (sem mudança de algoritmo)

- [ ] Upload PDF
- [ ] OCR (quando aplicável)
- [ ] Planilha
- [ ] Consulta IA com fontes
- [ ] Documentos: listar, detalhar, baixar
- [ ] Dashboard operacional sem permissão de usuários

## Continuidade

- [ ] Backup FULL executado
- [ ] Restore parcial testado em ambiente controlado (ou documentado)
- [ ] Plano de contingência lido pela equipe
- [ ] Contatos de suporte definidos

## LGPD

- [ ] Auditoria sem resposta integral / perguntas sensíveis desnecessárias
- [ ] Cache SHADOW (não serve respostas)
- [ ] Acesso a documentos e Consulta IA por permissão
- [ ] Orientação à clínica: não colar CPF/prontuário na Consulta IA sem necessidade

## Assinatura

| Papel | Nome | Data | OK |
|-------|------|------|----|
| Técnico | | | |
| Administrador clínica | | | |
| Homologação | | | |
