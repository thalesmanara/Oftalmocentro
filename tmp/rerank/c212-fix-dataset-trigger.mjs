#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

for (const id of ['12t0Ol6zWQJgAKPC', 'wTH2YV6pIlhzWDiY', 'qVH5qtBf8IY32uiH', 'KdpEmEGHNlPICOa4']) {
  const { rows } = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const trig = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const names = trig?.parameters?.workflowInputs?.values?.map((v) => v.name) || [];
  console.log(rows[0].name, 'trigger has force?', names.includes('forceContextFailureForTest'), names.filter((n) => /force|context/i.test(n)));
}

const vids = {};
vids.dataset = await bump('12t0Ol6zWQJgAKPC', 'Declare forceContextFailureForTest on DATASET trigger', (nodes) => {
  const trig = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const values = trig.parameters.workflowInputs.values;
  for (const name of ['forceContextFailureForTest', 'contextConfigOverrideAllowed', 'contextConfigVersionId']) {
    if (!values.some((v) => v.name === name)) values.push({ name, type: 'string' });
  }
});

// Also ensure Executar caso passes string 'true'/'false' for reliability
vids.dataset2 = await bump('12t0Ol6zWQJgAKPC', 'Pass force as string true/false to TESTE', (nodes) => {
  const n = nodes.find((x) => x.name === 'Executar caso' || /Executar caso/i.test(x.name));
  if (!n) throw new Error('Executar caso missing');
  n.parameters.workflowInputs.value.forceContextFailureForTest = `={{ (() => {
  const t=$('Trigger').first().json||{};
  return (t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true') ? 'true' : 'false';
})() }}`;
});

await client.end();
console.log(vids);
