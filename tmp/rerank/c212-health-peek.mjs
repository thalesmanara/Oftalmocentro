#!/usr/bin/env node
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token = login?.data?.accessToken || login?.data?.token;
const r = await fetch(`${BASE}/webhook/system/health`, {
  headers: { Authorization: `Bearer ${token}` },
});
const j = await r.json();
console.log('status', r.status);
console.log('keys', Object.keys(j?.data || j || {}));
console.log('contextWindow', JSON.stringify(j?.data?.contextWindow || j?.contextWindow, null, 2)?.slice(0, 1500));
console.log('retrieval', JSON.stringify(j?.data?.retrievalPipeline || j?.data?.retrieval, null, 2)?.slice(0, 500));
