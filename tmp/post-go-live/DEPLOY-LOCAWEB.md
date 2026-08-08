# Deploy frontend — Locaweb (Etapa 28.3)

O SPA produtivo está na **Locaweb**, não na Hostinger/VPS Coolify.

## Build gerado

```bash
npm run build
```

Artefatos em `dist/`:

- `index.html`
- `assets/index-B-Y5fMgf.js`
- `assets/index-EQrxvzdZ.css`
- `.htaccess`

## Publicação

1. Acesse o painel/File Manager ou FTP da Locaweb da clínica.
2. Abra o diretório público da aplicação: `oftalmocentrointeligente/`
3. Envie **todo o conteúdo** de `dist/` (substituindo os arquivos antigos).
4. Confirme no HTML publicado a referência a `assets/index-B-Y5fMgf.js`.
5. Abra `https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/` em aba anônima e valide login + Auditoria + tags de vigência.

## Observação

Não há credenciais Locaweb no repositório nem no VPS Coolify (`oftalmocentro`). O deploy permanece ação operacional externa até alguém com acesso publicar o `dist/`.
