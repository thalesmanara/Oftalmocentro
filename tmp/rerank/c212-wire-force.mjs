#!/usr/bin/env node
/**
 * Wire forceContextFailureForTest through EXECUTAR TESTE → Consulta.
 */
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

const trigger = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger' || n.name === 'Trigger');
const consulta = nodes.find((n) => /Chamar Consulta|Consulta IA/i.test(n.name));
console.log('trigger', trigger?.name, 'consulta', consulta?.name);

// Ensure trigger accepts the field (n8n trigger often passes all json)
if (consulta?.parameters?.workflowInputs?.value) {
  const v = consulta.parameters.workflowInputs.value;
  // jsonBody might be a string expression
  if (consulta.parameters.jsonBody) {
    let body = consulta.parameters.jsonBody;
    if (typeof body === 'string' && !body.includes('forceContextFailureForTest')) {
      // Common pattern: expression object
      console.log('jsonBody head', body.slice(0, 200));
    }
  }
  if (!v.forceContextFailureForTest) {
    v.forceContextFailureForTest =
      "={{ $('Trigger').first().json.forceContextFailureForTest === true || $('Trigger').first().json.forceContextFailureForTest === 'true' }}";
  }
  if (!v.contextConfigOverrideAllowed) {
    v.contextConfigOverrideAllowed =
      "={{ !!$('Trigger').first().json.contextConfigVersionId || $('Trigger').first().json.contextConfigOverrideAllowed === true }}";
  }
  consulta.parameters.workflowInputs.value = v;
  console.log('wired workflowInputs keys', Object.keys(v));
} else if (consulta?.parameters?.jsonBody) {
  // HTTP style
  console.log('using jsonBody');
}

// Also check if Consulta is called via httpRequest
if (consulta?.type === 'n8n-nodes-base.httpRequest') {
  let jb = consulta.parameters.jsonBody || consulta.parameters.body || '';
  if (typeof jb === 'string' && !jb.includes('forceContextFailureForTest')) {
    // try to inject into JSON expression
    if (jb.trim().startsWith('=')) {
      jb = jb.replace(
        /contextConfigVersionId/,
        `forceContextFailureForTest: $('Trigger').first().json.forceContextFailureForTest === true || $('Trigger').first().json.forceContextFailureForTest === 'true',\n  contextConfigVersionId`,
      );
      if (!jb.includes('forceContextFailureForTest')) {
        // append near end before closing
        jb = jb.replace(
          /\}\s*$/,
          `, forceContextFailureForTest: $('Trigger').first().json.forceContextFailureForTest === true || $('Trigger').first().json.forceContextFailureForTest === 'true' }`,
        );
      }
      if (consulta.parameters.jsonBody != null) consulta.parameters.jsonBody = jb;
      else consulta.parameters.body = jb;
      console.log('patched http jsonBody');
    }
  }
}

// Dump consulta node params keys
console.log('consulta type', consulta?.type);
console.log('consulta params keys', Object.keys(consulta?.parameters || {}));

const versionId = randomUUID();
const nodesJson = JSON.stringify(nodes);
const connJson = JSON.stringify(connections);
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,'Pass forceContextFailureForTest',false,NOW(),NOW())`,
  [versionId, 'KdpEmEGHNlPICOa4', nodesJson, connJson, rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [nodesJson, versionId, 'KdpEmEGHNlPICOa4'],
);
await client.query('COMMIT');
console.log('TESTE version', versionId);
await client.end();
