# Relatório — Administrador Técnico (Parte 2.1)

**Data:** 2026-08-04  
**Decisão de implementação:** concluída

## Modelagem

- Coluna `users.is_technical_admin BOOLEAN NOT NULL DEFAULT FALSE` (idempotente)
- Usuários existentes: todos `false`
- `is_master` preservado

## Backend / n8n

- `AUTH - LOGIN`, `AUTH - VALIDAR TOKEN`, `AUTH - CARREGAR USUÁRIO`: retornam `isTechnicalAdmin`
- `AUTH - VALIDAR PERMISSÃO`: aceita `requiredTechnicalAdmin` — concede se `isMaster || isTechnicalAdmin`; administrador técnico **não** tem bypass geral de permissões
- `GET/POST/PUT Usuários`: leem/escrevem o campo; sanitização de privilégios (somente Master atribui/revoga)
- 63 endpoints técnicos com `editar_configuracoes` passaram a exigir também `requiredTechnicalAdmin`
- `GET/PUT Configurações` institucionais **excluídos** do gate técnico

## React

- Tipos + parsers (`isTechnicalAdmin`)
- Helper `canAccessTechnicalAdministration(user)`
- Sidebar: seção ADMINISTRAÇÃO TÉCNICA só para Master/Técnico
- Rotas técnicas com `requireTechnicalAdmin`
- UsersPage: checkbox abaixo de Master + badges de perfil
- Settings: Health/Backup só para técnico; config institucional permanece com `editar_configuracoes`

## Testes automatizados

`tmp/tech-admin/tech-admin-tests.json` — **17/17 OK**

Inclui: migration, defaults, login/validate, 403 comum, grant/revoke técnico, health/prompts/retrieval, anti-escalation, build.

## Build

`npm run build` OK (`index-CPtQlBYK.js`).

## Versões IA

Nenhuma versão publicada de retrieval/context/cache/evidence/quality alterada.

## Observações

- Concessão de Administrador Técnico na UI: apenas Master.
- Deploy Hostinger do novo `dist/` ainda necessário para refletir a UI em produção.
- Aceite formal da Etapa 28 (backup externo) permanece independente desta entrega.
