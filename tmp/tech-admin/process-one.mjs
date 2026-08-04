#!/usr/bin/env node
import pg from 'pg';
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const id = 'a2d13fce-7562-4682-99eb-c48d9ca1655c';
const versionId = '55ce423b-b29a-467b-8ba1-7f398651f669';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
});
const lj = await login.json();
const token = lj.data.token;

await c.query(
  `UPDATE document_versions SET status='PROCESSING', processing_status='processing', validation_status='VALID' WHERE id=$1`,
  [versionId],
);
await c.query(`UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`, [id]);

console.log('process...');
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 600000);
const r = await fetch(`${BASE}/webhook/documents/process`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ documentId: id }),
  signal: controller.signal,
});
clearTimeout(t);
const text = await r.text();
console.log('status', r.status, text.slice(0, 300));

for (let i = 0; i < 60; i++) {
  const { rows } = await c.query(
    `SELECT d.processing_status, v.embedding_status, v.qdrant_sync_status,
            (SELECT COUNT(*)::int FROM document_chunks WHERE document_version_id=v.id) chunks,
            (SELECT COUNT(*)::int FROM document_chunks WHERE document_version_id=v.id AND embedding_status='VALID') valid
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  console.log('poll', i, rows[0]);
  if (rows[0].valid > 0 && rows[0].valid === rows[0].chunks) break;
  if (['failed', 'error'].includes(rows[0].processing_status) && i > 1) break;
  await new Promise((x) => setTimeout(x, 5000));
}

await c.query(
  `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
  [id],
);
await c.end();
