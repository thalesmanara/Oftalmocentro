#!/usr/bin/env node
/**
 * Fix: TESTE trigger force input, Consulta fallbackReason, health field passthrough.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

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

const vids = {};

vids.teste = await bump('KdpEmEGHNlPICOa4', 'Declare forceContextFailureForTest on TESTE trigger', (nodes) => {
  const trig = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const values = trig.parameters.workflowInputs.values;
  for (const name of ['forceContextFailureForTest', 'contextConfigOverrideAllowed']) {
    if (!values.some((v) => v.name === name)) {
      values.push({ name, type: 'string' });
    }
  }
});

vids.consulta = await bump('8EXk5RkFW5cxnenL', 'Expose sanitized fallbackReason in contextMeta', (nodes) => {
  const m = nodes.find((n) => n.name === 'Montar resposta');
  let code = m.parameters.jsCode;
  if (!code.includes('fallbackReason')) {
    code = code.replace(
      'fallbackUsed: contextMeta.fallbackUsed,',
      `fallbackUsed: contextMeta.fallbackUsed,
        fallbackReason: contextMeta.fallbackReason || null,`,
    );
    if (!code.includes('fallbackReason')) {
      throw new Error('Could not patch Montar resposta fallbackReason');
    }
    m.parameters.jsCode = code;
  }
});

// Health: find sanitizer that drops fields
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const code = n.parameters?.jsCode || '';
    if (/contextWindow|secretsMatch|components/.test(code) && n.name !== 'Aggregate health' && n.name !== 'Prepare checks') {
      console.log('health other', n.name);
      if (/contextWindow/.test(code)) {
        const i = code.indexOf('contextWindow');
        writeFileSync(new URL(`./_c212-hother-${n.name.replace(/\W+/g, '_')}.js`, import.meta.url), code);
        console.log(code.slice(i, i + 400));
      }
    }
  }
}

writeFileSync(new URL('./_c212-vids2.json', import.meta.url), JSON.stringify(vids, null, 2));
await client.end();
