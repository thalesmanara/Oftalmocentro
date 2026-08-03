#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

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
writeFileSync(new URL('./_c212-prep-publish.js', import.meta.url), code);

// Accept override OR forceOverride; reason OR overrideReason
if (!code.includes('body.override===true') && !code.includes('body.override === true')) {
  code = code.replace(
    /const errors=\[\];/,
    `const forceOverride=!!(body.forceOverride===true||body.override===true);
const overrideReason=String(body.overrideReason||body.reason||'').trim();
const errors=[];`,
  );
  code = code.replace(
    /if\(body\.forceOverride===true && !String\(body\.overrideReason\|\|''\)\.trim\(\)\)/,
    `if(forceOverride && !overrideReason)`,
  );
  code = code.replace(
    /forceOverride:!!body\.forceOverride,overrideReason:String\(body\.overrideReason\|\|''\)/,
    `forceOverride,overrideReason`,
  );
  // Also validationRunId from body
  if (!code.includes('validationRunId:body.validationRunId') && !code.includes('validationRunId: body')) {
    code = code.replace(
      /versionId:body\.versionId,/,
      `versionId:body.versionId,validationRunId:body.validationRunId||null,`,
    );
  }
  prep.parameters.jsCode = code;
  console.log('patched Preparar publish');
} else {
  console.log('already patched-ish');
}

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,'Accept override/reason aliases',false,NOW(),NOW())`,
  [versionId, 'f83073bfb4154115', JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), versionId, 'f83073bfb4154115'],
);
await client.query('COMMIT');
console.log('PUBLISH', versionId);
console.log(prep.parameters.jsCode.slice(0, 900));
await client.end();
