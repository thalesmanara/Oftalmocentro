# Deploy frontend — Locaweb (Encerramento Final)

O SPA produtivo está na **Locaweb**, não na Hostinger/VPS Coolify.

## Pacote pronto

- Pasta: `dist/`
- ZIP: `tmp/post-go-live/LOCAWEB-FRONTEND-FINAL.zip`

## Build gerado

```bash
npm run build
```

Artefatos a enviar (conteúdo completo de `dist/`):

| Arquivo | Obrigatório |
|---------|-------------|
| `index.html` | Sim |
| `.htaccess` | Sim (preservar rewrite/base path) |
| `assets/index-B-Y5fMgf.js` | Sim |
| `assets/index-EQrxvzdZ.css` | Sim |
| `vite.svg` | Sim |

## Diretório de destino

```
oftalmocentrouberaba.com.br / oftalmocentrointeligente/
```

Caminho público esperado: `/oftalmocentrointeligente/`

## Publicação (manual)

1. Acesse o painel/File Manager ou FTP da Locaweb da clínica.
2. Abra o diretório público `oftalmocentrointeligente/`.
3. Envie **todo o conteúdo** de `dist/` (ou extraia o ZIP), substituindo arquivos antigos.
4. Remova assets JS/CSS órfãos antigos quando seguro (ex.: `index-V49IbOIr.js`).
5. Confirme em `index.html` a referência a `assets/index-B-Y5fMgf.js`.
6. Hard refresh / aba anônima em  
   `https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/`

## Validação pós-deploy

- [ ] Domínio carrega `index-B-Y5fMgf.js`
- [ ] Login / logout
- [ ] Dashboard
- [ ] Tags EXPIRADO / VENCE EM BREVE
- [ ] Ordenação
- [ ] Ativo / inativo
- [ ] Administrador Técnico (gate de publish)
- [ ] Auditoria gerencial
- [ ] Detalhe técnico só Master/Technical Admin
- [ ] Consulta IA
- [ ] Aviso de resumo
- [ ] Refresh de rota

## Observação

Não há credenciais Locaweb no repositório nem no VPS Coolify (`oftalmocentro`).  
Esta etapa permanece **PENDÊNCIA OPERACIONAL EXTERNA** até a publicação manual.
