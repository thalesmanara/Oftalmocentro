#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='app_secrets' ORDER BY 1`,
);
console.log(cols.rows.map((r) => r.column_name));
const sample = await c.query(`SELECT * FROM app_secrets WHERE key LIKE 'cache%' LIMIT 1`);
console.log(sample.rows[0]);
await c.end();
