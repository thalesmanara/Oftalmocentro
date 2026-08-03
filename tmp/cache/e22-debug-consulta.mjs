#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT id, status, "startedAt", "stoppedAt", "workflowId"
   FROM execution_entity WHERE "workflowId"='8EXk5RkFW5cxnenL'
   ORDER BY "startedAt" DESC LIMIT 5`,
);
console.log(rows);

for (const r of rows.slice(0, 2)) {
  const d = await client.query(`SELECT data FROM execution_data WHERE "executionId"=$1 LIMIT 1`, [String(r.id)]);
  // might be compressed
  console.log('exec', r.id, 'data rows', d.rowCount, 'status', r.status);
}

// Check connections of Consulta for Respond path
const wf = await client.query(`SELECT connections, nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const conn = typeof wf.rows[0].connections === 'string' ? JSON.parse(wf.rows[0].connections) : wf.rows[0].connections;
const nodes = typeof wf.rows[0].nodes === 'string' ? JSON.parse(wf.rows[0].nodes) : wf.rows[0].nodes;
console.log('from Aplicar cache save', conn['Aplicar cache save']);
console.log('from Preparar sucesso', conn['Preparar sucesso']);
console.log('from Registrar auditoria sucesso', conn['Registrar auditoria sucesso']);
console.log('from Montar resposta', conn['Montar resposta']);
console.log('has Respond', nodes.some((n) => n.name === 'Respond to Webhook'));
console.log('Cache serve?', conn['Cache serve?']);
console.log('IA CONSULTAR', conn['IA - CONSULTAR CACHE']);

await client.end();
