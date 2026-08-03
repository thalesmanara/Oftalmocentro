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
const r = await fetch(`${BASE}/webhook/consulta-ia`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'Quem aparece na relação de funcionários em Excel?' }),
});
const text = await r.text();
console.log('status', r.status, 'len', text.length);
console.log(text.slice(0, 1500));
