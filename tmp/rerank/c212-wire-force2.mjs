#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function patch(id, label, mutator) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, rows[0].name, label],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [nodesJson, versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

// EXECUTAR DATASET: pass force to Executar caso
await patch('12t0Ol6zWQJgAKPC', 'Pass forceContextFailure to cases', (nodes) => {
  const exec = nodes.find((n) => /Executar caso/i.test(n.name));
  console.log('Executar caso type', exec?.type, Object.keys(exec?.parameters || {}));
  const inputs = exec?.parameters?.workflowInputs?.value;
  if (inputs && !inputs.forceContextFailureForTest) {
    inputs.forceContextFailureForTest =
      "={{ $('Trigger').first().json.forceContextFailureForTest === true || $('Trigger').first().json.forceContextFailureForTest === 'true' }}";
  }
  // Also dump mapping
  console.log('inputs', inputs ? Object.keys(inputs) : null);
});

// run-case / run-dataset webhooks: pass body field through
for (const id of ['qVH5qtBf8IY32uiH', 'wTH2YV6pIlhzWDiY']) {
  await patch(id, 'Forward forceContextFailureForTest', (nodes) => {
    const exec = nodes.find((n) => /Executar dataset/i.test(n.name));
    const inputs = exec?.parameters?.workflowInputs?.value;
    if (inputs && !inputs.forceContextFailureForTest) {
      inputs.forceContextFailureForTest = `={{ (() => {
  const b=$('Restaurar request').first().json.body||{};
  return b.forceContextFailureForTest===true||b.forceContextFailureForTest==='true';
})() }}`;
      console.log(id, 'inputs keys', Object.keys(inputs));
    } else {
      console.log(id, 'exec', exec?.name, !!inputs);
    }
  });
}

await client.end();
