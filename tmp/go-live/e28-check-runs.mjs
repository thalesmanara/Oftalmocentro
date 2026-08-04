#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(`
  SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score,
         started_at, finished_at, trigger_mode, retrieval_mode, retrieval_config_version
  FROM ai_test_runs
  ORDER BY started_at DESC LIMIT 20`);
console.log(JSON.stringify(r.rows, null, 2));
const cases = await c.query(`
  SELECT COUNT(*)::int AS n FROM ai_test_cases`);
console.log('cases_total', cases.rows[0]);
const full = await c.query(`
  SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score,
         started_at, finished_at, trigger_mode
  FROM ai_test_runs
  WHERE total_cases >= 50 OR COALESCE(trigger_mode,'') ILIKE '%dataset%'
  ORDER BY started_at DESC LIMIT 10`);
console.log('fullish', JSON.stringify(full.rows, null, 2));
const stuck = await c.query(
  `SELECT COUNT(*)::int AS n FROM ai_test_results WHERE run_id=$1`,
  ['46a5db07-ef07-43f5-a08b-6421ccda3bf2'],
);
console.log('stuck_results', stuck.rows[0]);
await c.end();
