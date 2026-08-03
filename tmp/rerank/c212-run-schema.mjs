#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const cons = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'ai_test_runs'::regclass
`);
console.log(cons.rows);

const statuses = await client.query(`SELECT DISTINCT status FROM ai_test_runs ORDER BY 1`);
console.log('statuses', statuses.rows);

const cols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='ai_test_runs' ORDER BY ordinal_position
`);
console.log(cols.rows.map((r) => r.column_name).join(', '));

await client.end();
