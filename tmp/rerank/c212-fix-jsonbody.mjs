#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const c = nodes.find((n) => n.name === 'Chamar Consulta IA');

c.parameters.jsonBody = `={{ JSON.stringify(Object.assign(
  { question: $json.question },
  $json.prompt_version_id ? { promptVersionId: $json.prompt_version_id } : {},
  $('Trigger').first().json.retrievalConfigVersionId ? { retrievalConfigVersionId: $('Trigger').first().json.retrievalConfigVersionId, modeOverrideAllowed: true } : {},
  $('Trigger').first().json.contextConfigVersionId ? { contextConfigVersionId: $('Trigger').first().json.contextConfigVersionId, contextConfigOverrideAllowed: true } : {},
  ($('Trigger').first().json.forceContextFailureForTest === true || $('Trigger').first().json.forceContextFailureForTest === 'true')
    ? { forceContextFailureForTest: true, contextConfigOverrideAllowed: true }
    : {}
)) }}`;

const versionId = randomUUID();
const nodesJson = JSON.stringify(nodes);
const connJson = JSON.stringify(connections);
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,'Fix forceContextFailure jsonBody',false,NOW(),NOW())`,
  [versionId, 'KdpEmEGHNlPICOa4', nodesJson, connJson, rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [nodesJson, versionId, 'KdpEmEGHNlPICOa4'],
);
await client.query('COMMIT');
console.log('fixed', versionId);
console.log(c.parameters.jsonBody);
await client.end();
