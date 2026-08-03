#!/usr/bin/env node
import { writeFileSync } from 'fs';
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const loginRes = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'compras@oftalmocentrouberaba.com.br', password: '12345678' }),
});
const loginText = await loginRes.text();
const login = JSON.parse(loginText);
const token = login.data?.accessToken || login.data?.token;
const hRes = await fetch(`${BASE}/webhook/system/health`, { headers: { Authorization: `Bearer ${token}` } });
const hText = await hRes.text();
writeFileSync(new URL('./_debug-health.txt', import.meta.url), `status=${hRes.status}\n` + hText.slice(0, 4000));
console.log('health status', hRes.status, 'len', hText.length, hText.slice(0, 500));

const dRes = await fetch(`${BASE}/webhook/system/ai-retrieval/detail`, { headers: { Authorization: `Bearer ${token}` } });
const dText = await dRes.text();
writeFileSync(new URL('./_debug-detail.txt', import.meta.url), `status=${dRes.status}\n` + dText.slice(0, 4000));
console.log('detail status', dRes.status, dText.slice(0, 800));
