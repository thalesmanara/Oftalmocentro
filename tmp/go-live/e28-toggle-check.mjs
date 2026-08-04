#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
// bounce active flag to encourage reload
for (const id of ['KdpEmEGHNlPICOa4']) {
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [id]);
  console.log('toggled', id);
}
// check progress
const run = await c.query(
  `SELECT id, status, total_cases, passed_count, failed_count, error_count FROM ai_test_runs WHERE id='26b2990a-dee7-4bef-803f-c9ade872a9d4'`,
);
console.log('run', run.rows[0]);
const res = await c.query(
  `SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE verdict='PASS') pass, COUNT(*) FILTER (WHERE verdict='FAIL') fail, COUNT(*) FILTER (WHERE verdict='ERROR') err FROM ai_test_results WHERE run_id='26b2990a-dee7-4bef-803f-c9ade872a9d4'`,
);
console.log('results', res.rows[0]);
const recent = await c.query(`
  SELECT id, status, "startedAt", "stoppedAt"
  FROM execution_entity
  WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "startedAt" > NOW() - INTERVAL '3 minutes'
  ORDER BY "startedAt" DESC LIMIT 8`);
console.log('recent execs', recent.rows);
await c.end();
