#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const runId = '248c1cfa-f0bc-43aa-8784-ff843f2bca93';
const run = await client.query(`SELECT * FROM ai_test_runs WHERE id=$1`, [runId]);
console.log('run keys', Object.keys(run.rows[0] || {}));
console.log('run status', run.rows[0]?.status, 'report', JSON.stringify(run.rows[0]?.report).slice(0, 2000));
console.log('metadata', run.rows[0]?.metadata);
console.log('context cols', {
  context_config_version_id: run.rows[0]?.context_config_version_id,
  context_mode_override_used: run.rows[0]?.context_mode_override_used,
});

// execution errors
const execs = await client.query(
  `SELECT id, status, "workflowId", "startedAt", "stoppedAt"
   FROM execution_entity
   WHERE "startedAt" > NOW() - INTERVAL '2 hours'
   ORDER BY "startedAt" DESC LIMIT 15`,
);
console.log('recent executions', execs.rows);

for (const e of execs.rows.slice(0, 5)) {
  const data = await client.query(
    `SELECT "workflowData", data FROM execution_data WHERE "executionId"=$1`,
    [String(e.id)],
  );
  if (!data.rows[0]) continue;
  let payload = data.rows[0].data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      /* keep */
    }
  }
  // n8n stores compressed sometimes
  const s = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const errIdx = s.indexOf('error');
  console.log('\nexec', e.id, e.workflowId, e.status, 'len', s.length);
  // find last node error messages
  const matches = s.match(/"message":"[^"]{10,200}"/g);
  console.log('messages sample', (matches || []).slice(0, 8));
}

// Check Inserir run SQL currently
const ds = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const nodes = typeof ds.rows[0].nodes === 'string' ? JSON.parse(ds.rows[0].nodes) : ds.rows[0].nodes;
const inserir = nodes.find((x) => /Inserir run/i.test(x.name));
console.log('\nInserir run query (full):\n', inserir?.parameters?.query);

// Check columns exist on ai_test_results
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_results' AND column_name LIKE '%context%' OR (table_name='ai_test_results' AND column_name IN ('relevant_context_rate','source_coverage','redundancy_rate','overflow_detected','empty_context','source_count','conflict_type')) ORDER BY column_name`,
);
console.log('\nresult context cols', cols.rows.map((r) => r.column_name));

const runCols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_runs' AND column_name LIKE '%context%' ORDER BY 1`,
);
console.log('run context cols', runCols.rows.map((r) => r.column_name));

await client.end();
