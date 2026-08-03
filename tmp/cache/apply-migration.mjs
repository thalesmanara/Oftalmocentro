#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const sql = readFileSync(new URL('./migration.sql', import.meta.url), 'utf8');
await client.query('BEGIN');
try {
  await client.query(sql);
  await client.query('COMMIT');
  console.log('migration OK');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('migration FAIL', e.message);
  process.exit(1);
}

const check = await client.query(`
  SELECT v.version_label, v.status, v.mode, v.id
  FROM ai_cache_config_versions v
  ORDER BY v.created_at`);
console.log('versions', check.rows);
const secrets = await client.query(`SELECT key,value FROM app_secrets WHERE key LIKE 'cache_%'`);
console.log('secrets', secrets.rows);
const tables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE '%cache%' ORDER BY 1`);
console.log('tables', tables.rows.map((r) => r.table_name));
await client.end();
