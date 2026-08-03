#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='f83073bfb4154115'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const prep = nodes.find((n) => n.name === 'Preparar publish');
let code = prep.parameters.jsCode;
code = code.replace('forceOverride,overrideReason.trim(),', 'forceOverride,overrideReason,');
// Also ensure Avaliar run checks context - verify current
const avaliar = nodes.find((n) => n.name === 'Avaliar run');
console.log('Avaliar run has context match', avaliar.parameters.jsCode.includes('context_config_version'));
prep.parameters.jsCode = code;

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,'Fix overrideReason syntax',false,NOW(),NOW())`,
  [versionId, 'f83073bfb4154115', JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), versionId, 'f83073bfb4154115'],
);
await client.query('COMMIT');
console.log('OK', versionId);
try {
  new Function(code);
  console.log('parse OK');
} catch (e) {
  console.log('parse FAIL', e.message);
}
await client.end();
