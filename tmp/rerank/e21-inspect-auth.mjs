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
console.log('login user', {
  keys: Object.keys(login?.data || {}),
  role: login?.data?.role,
  user: login?.data?.user,
  permissions: login?.data?.permissions,
});

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const auth = nodes.find((n) => n.name === 'Validar auth' || n.name === 'Validar permissão');
for (const n of nodes.filter((x) => /auth|permiss/i.test(x.name))) {
  console.log('\n==', n.name, n.type);
  console.log((n.parameters?.jsCode || JSON.stringify(n.parameters || {})).slice(0, 500));
}
await client.end();
