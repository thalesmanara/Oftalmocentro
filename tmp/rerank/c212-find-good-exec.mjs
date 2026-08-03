#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Find executions around successful retest runs with results
const runs = [
  '65f45dc5-fe61-4299-9d07-733f1f3ba3e7', // 1 PASS FAILED status
  'aefda2a4-bee3-4e4f-9005-6f8200d4083b', // 3 PASS FAILED
  '0f51aaa3-1456-4dd7-b3f0-facc05733cf7', // 13/14 PARTIAL should be
];

for (const runId of runs) {
  const r = await client.query(
    `SELECT id, status, total_cases, passed_count, failed_count, overall_score, started_at, finished_at FROM ai_test_runs WHERE id=$1`,
    [runId],
  );
  console.log('\nrun', r.rows[0]);
  // find dataset execution near that time
  const ex = await client.query(
    `SELECT id, status, "startedAt", "stoppedAt" FROM execution_entity
     WHERE "workflowId"='12t0Ol6zWQJgAKPC'
       AND "startedAt" BETWEEN $1::timestamptz - interval '2 seconds' AND $2::timestamptz + interval '2 seconds'
     ORDER BY "startedAt"`,
    [r.rows[0].started_at, r.rows[0].finished_at],
  );
  console.log('execs', ex.rows);
}

await client.end();
