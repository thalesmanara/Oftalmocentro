#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const t of ['ai_cache_metrics_daily', 'ai_prompt_versions', 'ai_prompts']) {
  const r = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
    [t],
  );
  console.log('\n', t, r.rows.length ? r.rows.map((x) => x.column_name).join(', ') : 'MISSING');
}
const u = await c.query(
  `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='ai_cache_metrics_daily'`,
);
console.log('indexes', u.rows);
await c.end();
