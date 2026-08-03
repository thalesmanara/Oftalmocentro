#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const cols = async (t) => {
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY 1`,
    [t],
  );
  console.log(t, r.rows.map((x) => x.column_name).join(', '));
};
await cols('ai_context_config_versions');
await cols('ai_test_metrics');
await cols('ai_test_runs');
const s = await c.query(`SELECT key FROM app_secrets WHERE key ILIKE '%context%' OR key ILIKE '%retrieval%'`);
console.log('secrets', s.rows.map((x) => x.key));
const r = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_results' AND column_name ILIKE '%context%'`,
);
console.log('result context cols', r.rows.map((x) => x.column_name));
await c.end();
