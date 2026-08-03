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
const res = await fetch(`${BASE}/webhook/system/health`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const json = await res.json();
const comps = json?.data?.components || json?.components || {};
console.log('status', res.status, json?.data?.status || json?.status);
console.log('keys', Object.keys(comps));
console.log('retrievalPipeline', comps.retrievalPipeline);
console.log('retrieval', comps.retrieval);
