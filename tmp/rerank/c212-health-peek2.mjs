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
const comps = j?.data?.components || j?.components || {};
console.log('component keys', Object.keys(comps));
console.log('contextWindow', JSON.stringify(comps.contextWindow, null, 2));
console.log('retrievalPipeline', JSON.stringify(comps.retrievalPipeline, null, 2)?.slice(0, 400));
console.log('top status', j?.data?.status || j?.status);
