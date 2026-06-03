# Oftalmocentro Inteligente

Aplicação administrativa para gestão documental da clínica oftalmológica (MVP com dados mockados).

## Stack

- React + TypeScript + Vite
- TailwindCSS v4
- React Router DOM
- Lucide React

## Arquitetura prevista

```
Frontend (React) → Webhooks/API n8n (VPS Hostinger) → PostgreSQL (VPS Hostinger)
```

O frontend **não** acessa o PostgreSQL diretamente. Os serviços em `src/services/` estão preparados para substituir mocks por chamadas HTTP quando o n8n estiver configurado.

## Desenvolvimento

```bash
npm install
npm run dev
```

### Login mockado

- **E-mail:** `master@oftalmocentro.com.br`
- **Senha:** `master123`

Usuário MASTER com todas as permissões habilitadas.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```
VITE_N8N_BASE_URL=https://seu-n8n.exemplo.com/webhook
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/login` | Autenticação mockada |
| `/dashboard` | Painel principal |
| `/documentos` | Biblioteca (cards/tabela) |
| `/documentos/novo` | Upload mockado |
| `/documentos/:id` | Detalhe do documento |
| `/usuarios` | Gestão de usuários e permissões |
| `/setores` | CRUD de setores |
| `/categorias` | CRUD de categorias |
| `/tags` | CRUD de tags |
| `/auditoria` | Logs de auditoria |
| `/configuracoes` | Identidade visual |
| `/minha-conta` | Perfil do usuário |
| `/consulta-ia` | Placeholder (próxima etapa) |

## Build

```bash
npm run build
```
