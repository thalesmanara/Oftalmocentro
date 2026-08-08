import pg from 'pg';
import { readFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const sql = readFileSync(new URL('./migration-documents-is-active.sql', import.meta.url), 'utf8');
await c.query(sql);
const col = await c.query(
  `SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name='documents' AND column_name='is_active'`,
);
console.log('column', col.rows);
const cnt = await c.query(
  `SELECT COUNT(*) FILTER (WHERE is_active)::int AS active,
          COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive
   FROM documents WHERE deleted_at IS NULL`,
);
console.log('counts', cnt.rows[0]);
await c.end();
