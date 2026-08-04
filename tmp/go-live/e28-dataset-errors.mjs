#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`
  SELECT id, status, \"startedAt\"
  FROM execution_entity
  WHERE \"workflowId\"='KdpEmEGHNlPICOa4' AND status='error'
  ORDER BY \"startedAt\" DESC LIMIT 3`);
for (const r of rows) {
  const d = await c.query(`SELECT data FROM execution_data WHERE \"executionId\"=$1`, [String(r.id)]);
  const raw = d.rows[0]?.data;
  const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  // find error messages
  const m = s.match(/"message":"[^"]{10,200}"/g);
  console.log('exec', r.id, m?.slice(0, 8));
  const idx = s.indexOf('error');
  console.log('snippet', s.slice(Math.max(0, idx - 50), idx + 300));
}
const res = await c.query(
  `SELECT COUNT(*)::int n FROM ai_test_results WHERE run_id='26b2990a-dee7-4bef-803f-c9ade872a9d4'`,
);
console.log('results so far', res.rows[0]);
const parent = await c.query(`
  SELECT id, status, \"startedAt\", \"stoppedAt\"
  FROM execution_entity
  WHERE \"workflowId\" IN ('12t0Ol6zWQJgAKPC','wTH2YV6pIlhzWDiY')
    AND \"startedAt\" > NOW() - INTERVAL '40 minutes'
  ORDER BY \"startedAt\" DESC LIMIT 5`);
console.log('parents', parent.rows);
await c.end();
