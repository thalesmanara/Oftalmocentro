#!/usr/bin/env node
import pg from 'pg';
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
const cw = j?.data?.components?.contextWindow || j?.components?.contextWindow;
console.log(JSON.stringify(cw, null, 2));

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
// Who owns /system/health webhook?
const { rows } = await client.query(
  `SELECT id, name FROM workflow_entity WHERE nodes::text ILIKE '%system/health%' OR nodes::text ILIKE '%/health%'`,
);
console.log('workflows mentioning health path', rows.map((r) => `${r.id} ${r.name}`));
await client.end();
