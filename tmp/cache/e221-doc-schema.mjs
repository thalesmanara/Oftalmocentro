#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const t of ['document_versions', 'document_chunks', 'documents']) {
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY 1`,
    [t],
  );
  console.log('\n', t, r.rows.map((x) => x.column_name).join(', '));
}
await c.end();
