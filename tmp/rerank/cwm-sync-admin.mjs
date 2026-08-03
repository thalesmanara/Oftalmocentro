#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const admin = JSON.parse(readFileSync(new URL('./_cwm-admin-ids.json', import.meta.url), 'utf8'));
const ids = [
  '7995896871ed4947',
  'e4c0829578124470',
  '5fbdabb413c3405d',
  admin.UPDATE,
  admin.VALIDATE,
  admin.PUBLISH,
  admin.ROLLBACK,
  '70fd9924711b45f1',
  '0289408b8d774379',
  'e95a92295d7c4deb',
  '8EXk5RkFW5cxnenL',
];

for (const id of ids) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  if (!wf) continue;
  const nodes = typeof wf.nodes === 'string' ? wf.nodes : JSON.stringify(wf.nodes);
  const connections =
    typeof wf.connections === 'string' ? wf.connections : JSON.stringify(wf.connections);
  if (!wf.activeVersionId) {
    const versionId = randomUUID();
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21',$3::json,$4::json,$5,'',false,NOW(),NOW())`,
      [versionId, id, nodes, connections, wf.name],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar, active=true WHERE id=$2`,
      [versionId, id],
    );
    console.log('created', wf.name);
  } else {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4::varchar`,
      [nodes, connections, id, wf.activeVersionId],
    );
    console.log('synced', wf.name);
  }
}
await client.end();
