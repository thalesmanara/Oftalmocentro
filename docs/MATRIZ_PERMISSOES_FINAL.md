# Matriz de Permissões Final — Oftalmocentro Inteligente

Homologação Etapa 28 + Parte 2.1 (Administrador Técnico).

## Códigos e flags

| Código / flag | Área |
|--------|------|
| visualizar_documentos | Biblioteca / detalhe |
| cadastrar_documentos | Upload |
| editar_documentos | Edição |
| excluir_documentos | Exclusão |
| usar_consulta_ia | Consulta IA |
| gerenciar_usuarios | Usuários |
| gerenciar_setores | Setores |
| gerenciar_categorias | Categorias/Subcategorias |
| editar_configuracoes | Configurações institucionais (+ ações técnicas quando combinado) |
| visualizar_auditoria | Auditoria operacional |
| `isMaster` | Bypass total de permissões |
| `isTechnicalAdmin` | Acesso à Administração Técnica (sem bypass geral) |

## Distinções obrigatórias

| Perfil | Flag / regra | O que libera |
|--------|--------------|--------------|
| Master | `isMaster` | Tudo |
| Administrador técnico | `isTechnicalAdmin` | Seção ADMINISTRAÇÃO TÉCNICA + endpoints técnicos (`requiredTechnicalAdmin`) |
| Administrador comum | permissões admin | Usuários/setores/categorias/config institucionais/auditoria — **sem** telas técnicas só por `editar_configuracoes` |
| Operacional | permissões operacionais | Operação do dia a dia |

`editar_configuracoes` **sozinho** não libera mais Validação IA, Prompts, Retrieval, Contexto, Cache, Evidências, Qualidade, Qdrant, Health técnico nem Backups.

## Perfis homologados

### 1. Operacional somente leitura
- Menus: Dashboard, Documentos
- Sem Upload / Consulta IA / Admin / Técnico

### 2. Operacional com upload
- + Upload (`cadastrar_documentos`)

### 3. Operacional com Consulta IA
- + Consulta IA (`usar_consulta_ia`)

### 4. Administrador de documentos
- visualizar + cadastrar + editar (+ excluir se concedido)

### 5. Administrador de usuários
- + Usuários (`gerenciar_usuarios`)
- Não atribui Master nem Administrador técnico (somente Master faz isso)

### 6. Administrador técnico
- `isTechnicalAdmin = true`
- Vê seção ADMINISTRAÇÃO TÉCNICA
- Endpoints técnicos exigem também a permissão funcional quando aplicável (ex.: `editar_configuracoes` em mutações)
- **Não** é Master; **não** bypassa permissões operacionais

### 7. Master
- Acesso completo (bypass), inclusive técnico

## Menus × seção

| Seção | Item | Regra |
|-------|------|-------|
| OPERAÇÃO | Dashboard | autenticado |
| OPERAÇÃO | Documentos / Upload / Consulta IA | permissão operacional |
| ADMINISTRAÇÃO | Usuários / Setores / Categorias / Configurações / Auditoria | permissão administrativa |
| ADMINISTRAÇÃO TÉCNICA | Validação, Prompts, Retrieval, Contexto, Cache, Evidências, Qualidade, Qdrant, Health, Backups | `isMaster` **ou** `isTechnicalAdmin` |

## Backend

- Campo: `users.is_technical_admin`
- Contrato: `isTechnicalAdmin`
- Gate central: `AUTH - VALIDAR PERMISSÃO` com `requiredTechnicalAdmin: true`
