#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const w = await c.query(
  `SELECT method, "webhookPath", "workflowId", node FROM webhook_entity WHERE "webhookPath" LIKE 'system/ai-evidence%' ORDER BY 2`,
);
console.log(w.rows);
await c.end();

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
const r = await fetch(`${BASE}/webhook/system/ai-evidence/detail`, {
  headers: { Authorization: `Bearer ${token}` },
});
const buf = Buffer.from(await r.arrayBuffer());
console.log('status', r.status, 'len', buf.length, 'head', buf.slice(0, 300).toString('utf8'));
