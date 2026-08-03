#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Find latest executions via execution_metadata or similar
const tables = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%execut%'`,
);
console.log(tables.rows);

const recent = await client.query(
  `SELECT id, status, "workflowId", "startedAt", "stoppedAt"
   FROM execution_entity
   WHERE "workflowId" IN ('qAyYc9DrHIqe4L9i','2UPHcxASp2PboC9M')
   ORDER BY "startedAt" DESC LIMIT 10`,
);
console.log(recent.rows);

if (recent.rows[0]) {
  const id = recent.rows[0].id;
  // execution_data
  const data = await client.query(
    `SELECT * FROM execution_data WHERE "executionId"=$1 LIMIT 1`,
    [String(id)],
  ).catch((e) => ({ rows: [], err: e.message }));
  console.log('execution_data', data.err || Object.keys(data.rows[0] || {}), data.rows[0] ? String(data.rows[0].data || data.rows[0].workflowData || '').slice(0, 500) : '');
  if (data.rows[0]) {
    writeFileSync(new URL('./_exec-data.json', import.meta.url), JSON.stringify(data.rows[0]).slice(0, 50000));
  }
}

// Try simplifying: wrap Aggregate in try/catch returning error detail
const { rows } = await client.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const agg = nodes.find((n) => n.name === 'Aggregate health');
if (!agg.parameters.jsCode.includes('AGG_CATCH')) {
  agg.parameters.jsCode = `try {\n${agg.parameters.jsCode}\n} catch (err) {\n  return [{ json: { status: 'down', checkedAt: new Date().toISOString(), components: { n8n: { status: 'ok' }, database: { status: 'down' } }, httpStatus: 503, AGG_CATCH: String(err && err.message || err) } }];\n}`;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json WHERE id='qAyYc9DrHIqe4L9i'`, [JSON.stringify(nodes)]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  console.log('wrapped Aggregate with catch');
}

await client.end();
