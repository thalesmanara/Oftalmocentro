#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const groups = await c.query(`
  SELECT COALESCE(group_name,'(null)') AS g, COUNT(*)::int AS n
  FROM ai_test_cases
  GROUP BY 1 ORDER BY 2 DESC`);
console.log('groups', groups.rows);
const big = await c.query(`
  SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score,
         started_at, finished_at, trigger_mode
  FROM ai_test_runs
  WHERE total_cases >= 80
  ORDER BY started_at DESC LIMIT 5`);
console.log('big runs', big.rows);
const cols = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_cases' ORDER BY ordinal_position`);
console.log('case cols', cols.rows.map((r) => r.column_name));
await c.end();
