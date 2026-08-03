#!/usr/bin/env node
/** Fix Consulta IA: candidates must come from Merge híbrido, not LOAD_CFG output. */
import pg from 'pg';

const CONSULTA = '8EXk5RkFW5cxnenL';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [CONSULTA],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const prep = nodes.find((n) => n.name === 'Preparar seleção retrieval');
if (!prep) throw new Error('Preparar seleção retrieval missing');

const old = prep.parameters.jsCode;
if (!old.includes("$('Merge híbrido')")) {
  prep.parameters.jsCode = old.replace(
    "const candidates=$input.all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));",
    "const candidates=$('Merge híbrido').all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));",
  );
  if (prep.parameters.jsCode === old) {
    // try alternate
    prep.parameters.jsCode = old.replace(
      /const candidates=\$input\.all\(\)[^;]+;/,
      "const candidates=$('Merge híbrido').all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));",
    );
  }
}

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), JSON.stringify(connections), CONSULTA],
);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), CONSULTA, rows[0].activeVersionId],
  );
}
console.log('fixed', prep.parameters.jsCode.includes("$('Merge híbrido')"));
await client.end();
