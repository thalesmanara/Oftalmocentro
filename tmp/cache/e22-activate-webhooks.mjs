#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ids = [
  'c22CacheList0000001',
  'c22CacheDetail00001',
  'c22CacheCreate00001',
  'c22CacheValidate001',
  'c22CachePublish0001',
  'c22CacheRollback001',
  'c22CacheInvalidate01',
  'c22CacheCleanup0001',
  'c22CacheCompare0001',
  'c22CacheUpdate00001',
  'c22CacheRuntime0001',
];

await client.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id = ANY($1::varchar[])`, [ids]);

const tables = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%webhook%' ORDER BY 1`,
);
console.log('webhook tables', tables.rows);

// Sample existing webhook registration for ai-context
const sample = await client.query(
  `SELECT id, name, active FROM workflow_entity WHERE name ILIKE '%AI CONTEXT LIST%' OR name ILIKE '%AI CONTEXT%' LIMIT 10`,
);
console.log('context wfs', sample.rows);

if (tables.rows.some((r) => r.table_name === 'webhook_entity')) {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='webhook_entity' ORDER BY 1`,
  );
  console.log('webhook_entity cols', cols.rows.map((r) => r.column_name));
  const existing = await client.query(`SELECT * FROM webhook_entity WHERE webhook_path ILIKE '%ai-context%' LIMIT 3`);
  console.log('sample webhooks', existing.rows);
}

await client.end();
