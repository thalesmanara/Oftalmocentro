# Manual do Administrador — Oftalmocentro Inteligente

Para gestores e administradores da clínica (não é o guia técnico de IA).

## Usuários

Em **Usuários** (permissão `gerenciar_usuarios`):

- criar e editar usuários;
- ativar/inativar;
- atribuir permissões;
- definir setor;
- marcar **Usuário master** e/ou **Administrador técnico** (somente Master concede/revoga o técnico).

Regras de senha:

- criação e alteração exigem no mínimo **8 caracteres**;
- senhas legadas com menos de 8 caracteres continuam autenticando até serem trocadas.

Master possui acesso completo. Administrador técnico acessa a Administração Técnica (monitoramento e governança), sem bypass geral das permissões operacionais.

## Permissões principais

| Código | Uso |
|--------|-----|
| visualizar_documentos | Biblioteca |
| cadastrar_documentos | Upload |
| editar_documentos | Edição |
| excluir_documentos | Exclusão |
| usar_consulta_ia | Consulta IA |
| gerenciar_usuarios | Usuários |
| gerenciar_setores | Setores |
| gerenciar_categorias | Categorias/Subcategorias |
| editar_configuracoes | Configurações e área técnica |
| visualizar_auditoria | Auditoria |

## Setores

Organize a estrutura institucional. Documentos e usuários referenciam setores.

## Categorias e subcategorias

Classificam documentos para busca e consulta. Mantenha nomes claros e estáveis.

## Configurações

Nome da clínica, identidade visual e painéis administrativos (health/backups conforme tela).

## Auditoria

Consulta eventos de segurança e operação. Use para investigação de acessos e ações relevantes.

## Health resumido

Em Configurações / Health: visão de componentes do sistema (documentos, IA, filas). Não altera produção por si só.

## Backups

Painel de backups institucionais. Execuções completas seguem o procedimento da equipe técnica.

## Administração × Administração técnica

- **Administração:** usuários, cadastros, configurações, auditoria.
- **Administração técnica:** prompts, retrieval, cache, evidências, qualidade/política, Qdrant, validação IA.

A clínica opera sem abrir a área técnica no dia a dia.

## Documentos ativos e vigência

- Na edição do documento, use **Documento ativo** para manter o arquivo armazenado sem uso pela IA.
- Documentos **inativos** e **expirados** não entram nas fontes da Consulta IA.
- O Dashboard lista expirados e vencimentos nos próximos 60 dias para acompanhamento.

## Quando chamar o suporte técnico

- falhas recorrentes de processamento/OCR;
- Consulta IA indisponível;
- necessidade de publicar versão de IA;
- reindexação Qdrant;
- inconsistência de health/backup.

Não compartilhe senhas, tokens ou connection strings neste canal.
