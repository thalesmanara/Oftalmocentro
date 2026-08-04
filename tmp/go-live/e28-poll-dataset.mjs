#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const run = await c.query(
  `SELECT id, status, total_cases, passed_count, failed_count, error_count, skipped_count, overall_score, finished_at FROM ai_test_runs WHERE id='26b2990a-dee7-4bef-803f-c9ade872a9d4'`,
);
const res = await c.query(
  `SELECT COUNT(*)::int n,
          COUNT(*) FILTER (WHERE verdict='PASS')::int pass,
          COUNT(*) FILTER (WHERE verdict='FAIL')::int fail,
          COUNT(*) FILTER (WHERE verdict='ERROR')::int err,
          COUNT(*) FILTER (WHERE UPPER(verdict) LIKE 'SKIP%')::int skip
   FROM ai_test_results WHERE run_id='26b2990a-dee7-4bef-803f-c9ade872a9d4'`,
);
const parents = await c.query(`
  SELECT id, status, "startedAt", "stoppedAt"
  FROM execution_entity
  WHERE id IN (20816, 20808) OR ("workflowId" IN ('12t0Ol6zWQJgAKPC','wTH2YV6pIlhzWDiY') AND "startedAt" > NOW() - INTERVAL '90 minutes' AND status='running')
  ORDER BY "startedAt" DESC LIMIT 5`);
const recent = await c.query(`
  SELECT status, COUNT(*)::int n
  FROM execution_entity
  WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "startedAt" > NOW() - INTERVAL '15 minutes'
  GROUP BY 1`);
console.log(JSON.stringify({ run: run.rows[0], results: res.rows[0], parents: parents.rows, recentCaseStatus: recent.rows }, null, 2));
await c.end();
