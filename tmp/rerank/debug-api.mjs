#!/usr/bin/env node
import { writeFileSync } from 'fs';
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'compras@oftalmocentrouberaba.com.br', password: '12345678' }),
}).then((r) => r.json());
const token = login.data?.accessToken || login.data?.token;
const h = await fetch(`${BASE}/webhook/system/health`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const d = await fetch(`${BASE}/webhook/system/ai-retrieval/detail`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
writeFileSync(new URL('./_debug-api.json', import.meta.url), JSON.stringify({
  healthKeys: Object.keys(h.data?.components || h.components || {}),
  retrieval: h.data?.components?.retrieval || h.components?.retrieval,
  detail: d,
}, null, 2));
console.log('health keys', Object.keys(h.data?.components || {}));
console.log('retrieval', h.data?.components?.retrieval);
console.log('detail keys', Object.keys(d.data || d));
console.log('versions', (d.data?.versions || []).length);
