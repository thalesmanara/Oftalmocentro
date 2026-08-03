#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const CONSULTA = '8EXk5RkFW5cxnenL';
const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [CONSULTA],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.name === 'Aplicar prompt carregado');
if (!n) throw new Error('node missing');
n.parameters.jsCode = n.parameters.jsCode.replace(
  "$('Montar contexto')",
  "$('Aplicar contexto recuperado')",
);
if (n.parameters.jsCode.includes('Montar contexto')) {
  throw new Error('still references Montar contexto');
}

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`,
  [JSON.stringify(nodes), CONSULTA],
);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW()
     WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), CONSULTA, rows[0].activeVersionId],
  );
}
console.log('fixed Aplicar prompt carregado');
await client.end();
