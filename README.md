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

- **E-mail:** `admin@oftalmocentro.cloud`
- **Senha:** `admin123`

Sessão persistida em `localStorage` (`user` + `token`). Integração futura via `authService` → `POST ${VITE_N8N_BASE_URL}/webhook/auth/login`.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```
VITE_N8N_BASE_URL=https://n8n.oftalmocentrouberaba.cloud
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

## Deploy (subpasta)

O sistema é publicado em:

**https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/**

Configurações já aplicadas:

- `base` no Vite: `/oftalmocentrointeligente/`
- `basename` no React Router: `/oftalmocentrointeligente`
- `.htaccess` em `public/` (copiado para `dist/` no build) — necessário no Apache/Hostinger para rotas do SPA (evita 404 ao atualizar a página)

Após o build, envie o conteúdo da pasta `dist/` para o diretório `oftalmocentrointeligente/` no servidor.

## Build

```bash
npm run build
```

Em desenvolvimento local, o app continua em `http://localhost:5173/oftalmocentrointeligente/` (com o mesmo `base`).
