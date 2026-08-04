#!/usr/bin/env node
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';

const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
});
const lj = await login.json();
const token = lj?.data?.token;
console.log('login', login.status, 'tech', lj?.data?.user?.isTechnicalAdmin);

const r = await fetch(`${BASE}/webhook/system/embeddings/reprocess`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ force: true, limit: 50 }),
});
const text = await r.text();
console.log('status', r.status);
console.log(text.slice(0, 1500));
