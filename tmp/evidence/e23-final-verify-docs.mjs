import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  ssl: false,
});
await c.connect();

const { rows } = await c.query(`
  SELECT id, name, active
  FROM workflow_entity
  WHERE nodes::text LIKE '%qdrantSyncedAt%",%FROM%'
     OR nodes::text LIKE '%qdrantSyncedAt",' || chr(10) || 'FROM%'
`);
console.log('still broken candidates', rows.length);
for (const r of rows) console.log(r.active ? 'ON' : 'off', r.id, r.name);

// Broader: any ,\nFROM after qdrant
const { rows: all } = await c.query(`
  SELECT id, name, active, nodes::text AS n
  FROM workflow_entity
  WHERE nodes::text ILIKE '%qdrant_synced_at%'
`);
let bad = 0;
for (const r of all) {
  if (/qdrantSyncedAt\",\s*\nFROM/.test(r.n) || /qdrant_synced_at[^\n]*,\s*\nFROM/.test(r.n)) {
    bad++;
    console.log('BAD', r.id, r.name);
  }
}
console.log('scanned', all.length, 'bad', bad);

// Quick live check of versions endpoint needs a doc id
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
const token = login?.data?.accessToken;
const docs = await (
  await fetch(`${BASE}/webhook/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();
const first = docs?.data?.[0];
console.log('docs ok', docs?.success, 'count', docs?.data?.length, 'first', first?.id?.slice(0, 8));
if (first?.id) {
  const v = await fetch(
    `${BASE}/webhook/documents/versions?documentId=${encodeURIComponent(first.id)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const vt = await v.text();
  console.log('versions', v.status, vt.slice(0, 180));
}

await c.end();
