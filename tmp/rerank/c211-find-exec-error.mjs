#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Confirm Inserir still has =
const ds = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const nodes = typeof ds.rows[0].nodes === 'string' ? JSON.parse(ds.rows[0].nodes) : ds.rows[0].nodes;
const inserir = nodes.find((x) => /Inserir run/i.test(x.name));
console.log('Inserir starts with', JSON.stringify(inserir.parameters.query.slice(0, 20)));

const fails = await client.query(
  `SELECT id, status, "startedAt" FROM execution_entity
   WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "startedAt" > NOW() - INTERVAL '4 hours'
   ORDER BY "startedAt" DESC LIMIT 15`,
);
console.log('TESTE execs', fails.rows);

for (const e of fails.rows.slice(0, 5)) {
  const data = await client.query(`SELECT data FROM execution_data WHERE "executionId"=$1`, [String(e.id)]);
  if (!data.rows[0]) {
    console.log(e.id, 'no data');
    continue;
  }
  let raw = data.rows[0].data;
  let s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  console.log('\n===', e.id, e.status, 'len', s.length, '===');
  // n8n sometimes stores as {"version":1,"startData":...} or compressed buffer
  if (s.includes('INSERT INTO ai_test_results') || s.includes('column') || s.includes('error')) {
    const snippets = [];
    for (const re of [
      /"message":"[^"]{5,300}"/g,
      /column "[^"]+"/g,
      /ERROR:[^\\"]{5,200}/g,
      /syntax error[^\\"]{0,120}/gi,
    ]) {
      const m = [...s.matchAll(re)].slice(0, 6);
      for (const x of m) snippets.push(x[0]);
    }
    console.log([...new Set(snippets)].slice(0, 20));
  } else {
    console.log('preview', s.slice(0, 200));
  }
}

// Also check run-case workflow executions
const rc = await client.query(
  `SELECT id, status, "startedAt", "workflowId" FROM execution_entity
   WHERE "workflowId" IN ('qVH5qtBf8IY32uiH','12t0Ol6zWQJgAKPC','wTH2YV6pIlhzWDiY')
     AND "startedAt" > NOW() - INTERVAL '4 hours'
   ORDER BY "startedAt" DESC LIMIT 20`,
);
console.log('\nrun-case/dataset execs', rc.rows);

await client.end();
