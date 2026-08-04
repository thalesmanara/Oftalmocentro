#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const m = nodes.find((n) => n.name === 'Montar resposta admin');
let code = m.parameters.jsCode;
if (!code.includes("'responseQuality'")) {
  code = code.replace(
    "'semanticCache','evidenceLayer']",
    "'semanticCache','evidenceLayer','responseQuality']",
  );
  if (!code.includes("'responseQuality'")) {
    code = code.replace("'evidenceLayer']", "'evidenceLayer','responseQuality']");
  }
}
m.parameters.jsCode = code;
console.log(
  'allowlist now',
  code.split('\n').find((l) => l.includes('allowedCompKeys')),
);

const versionId = randomUUID();
await c.query('BEGIN');
await c.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,'allowlist rq',false,NOW(),NOW())`,
  [versionId, '2UPHcxASp2PboC9M', JSON.stringify(nodes), JSON.stringify(rows[0].connections), rows[0].name],
);
await c.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), versionId, '2UPHcxASp2PboC9M'],
);
await c.query('COMMIT');
await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`);
await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`);
console.log('saved', versionId);
await c.end();
