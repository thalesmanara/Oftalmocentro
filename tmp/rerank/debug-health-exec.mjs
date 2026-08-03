#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='execution_entity' ORDER BY ordinal_position`,
);
console.log(cols.rows.map((r) => r.column_name).join(', '));

const execs = await client.query(
  `SELECT id, "workflowId", status, "startedAt", "stoppedAt",
     left(COALESCE(data::text,''), 200) as data_preview
   FROM execution_entity
   WHERE "workflowId" IN ('qAyYc9DrHIqe4L9i','2UPHcxASp2PboC9M')
   ORDER BY "startedAt" DESC LIMIT 5`,
).catch(async (e) => {
  console.log('exec fail', e.message);
  // try execution_data
  return { rows: [] };
});
console.log(execs.rows);

// Check if Aggregate JS parses
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const prep = nodes.find((n) => n.name === 'Prepare checks');
const agg = nodes.find((n) => n.name === 'Aggregate health');
try {
  new Function(prep.parameters.jsCode);
  console.log('Prepare checks syntax OK');
} catch (e) {
  console.log('Prepare checks SYNTAX', e.message);
}
try {
  new Function(agg.parameters.jsCode);
  console.log('Aggregate syntax OK');
} catch (e) {
  console.log('Aggregate SYNTAX', e.message);
}

// Compare with a known-good snapshot: remove retrieval from aggregate temporarily and see?
// Instead check GET health Montar resposta for empty components path
const g = await client.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const gnodes = typeof g.rows[0].nodes === 'string' ? JSON.parse(g.rows[0].nodes) : g.rows[0].nodes;
const montar = gnodes.find((n) => n.name === 'Montar resposta admin' || n.parameters?.jsCode?.includes('components'));
writeFileSync(new URL('./_health-get-montar.js', import.meta.url), montar?.parameters?.jsCode || 'none');
console.log('montar node', montar?.name);

await client.end();
