#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Fix leading = on Inserir run in EXECUTAR DATASET
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let fixed = 0;
  for (const n of nodes) {
    if (n.parameters?.query && typeof n.parameters.query === 'string' && n.parameters.query.startsWith('=')) {
      console.log('Fixing leading = in', n.name);
      n.parameters.query = n.parameters.query.replace(/^=+/, '');
      fixed++;
    }
  }
  if (fixed) {
    const versionId = randomUUID();
    const nodesJson = JSON.stringify(nodes);
    const connJson = JSON.stringify(rows[0].connections);
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1,$2,'etapa21.1',$3::json,$4::json,$5,'Fix leading = Inserir run',false,NOW(),NOW())`,
      [versionId, '12t0Ol6zWQJgAKPC', nodesJson, connJson, rows[0].name],
    );
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2, "activeVersionId"=$2, "updatedAt"=NOW() WHERE id='12t0Ol6zWQJgAKPC'`,
      [nodesJson, versionId],
    );
    await client.query('COMMIT');
    console.log('DATASET fixed', versionId);
  } else {
    console.log('No leading = in DATASET');
  }
}

// Also check EXECUTAR TESTE for similar
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let fixed = 0;
  for (const n of nodes) {
    if (n.parameters?.query && typeof n.parameters.query === 'string' && n.parameters.query.trimStart().startsWith('=')) {
      console.log('Fixing leading = in TESTE', n.name);
      n.parameters.query = n.parameters.query.replace(/^\s*=+/, '');
      fixed++;
    }
  }
  // Also dump Avaliar insert column count vs value issues - try dry parse of last SQL pattern
  const av = nodes.find((x) => x.name === 'Avaliar e montar insert');
  const code = av.parameters.jsCode;
  // Check conflict_detected column exists usage
  console.log('conflict_detected in INSERT cols', code.includes('conflict_detected'));
  console.log('conflictDetected in VALUES', code.includes('conflictDetected ?'));

  if (fixed) {
    const versionId = randomUUID();
    const nodesJson = JSON.stringify(nodes);
    const connJson = JSON.stringify(rows[0].connections);
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1,$2,'etapa21.1',$3::json,$4::json,$5,'Fix leading =',false,NOW(),NOW())`,
      [versionId, 'KdpEmEGHNlPICOa4', nodesJson, connJson, rows[0].name],
    );
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2, "activeVersionId"=$2, "updatedAt"=NOW() WHERE id='KdpEmEGHNlPICOa4'`,
      [nodesJson, versionId],
    );
    await client.query('COMMIT');
    console.log('TESTE fixed', versionId);
  }
}

// Find failed executions of EXECUTAR TESTE
const fails = await client.query(
  `SELECT id, status, "startedAt" FROM execution_entity
   WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "startedAt" > NOW() - INTERVAL '3 hours'
   ORDER BY "startedAt" DESC LIMIT 10`,
);
console.log('TESTE execs', fails.rows);

for (const e of fails.rows.slice(0, 3)) {
  const data = await client.query(`SELECT data FROM execution_data WHERE "executionId"=$1`, [String(e.id)]);
  if (!data.rows[0]) continue;
  let s = typeof data.rows[0].data === 'string' ? data.rows[0].data : JSON.stringify(data.rows[0].data);
  // look for error objects
  const errMatches = [...s.matchAll(/"error":\{[^}]{0,500}/g)].slice(0, 5);
  console.log('\nexec', e.id, e.status);
  for (const m of errMatches) console.log(m[0].slice(0, 400));
  const msg = [...s.matchAll(/column [^\\"]+/gi)].slice(0, 10);
  for (const m of msg) console.log('col hint', m[0]);
  const pq = [...s.matchAll(/PostgreSQL[^\\"]{0,200}/gi)].slice(0, 5);
  for (const m of pq) console.log('pg', m[0]);
}

await client.end();
