#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ids = [
  '70fd9924711b45f1', // LOAD
  '0289408b8d774379', // VALIDATE
  'e95a92295d7c4deb', // CWM
  '8EXk5RkFW5cxnenL', // Consulta
];

for (const id of ids) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  if (!wf) {
    console.log('missing', id);
    continue;
  }
  const nodes = typeof wf.nodes === 'string' ? wf.nodes : JSON.stringify(wf.nodes);
  const connections =
    typeof wf.connections === 'string' ? wf.connections : JSON.stringify(wf.connections);
  let versionId = wf.activeVersionId;
  if (!versionId) {
    versionId = randomUUID();
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21',$3::json,$4::json,$5,'',false,NOW(),NOW())`,
      [versionId, id, nodes, connections, wf.name],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar, active=true WHERE id=$2`,
      [versionId, id],
    );
    console.log('created history', wf.name, versionId);
  } else {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4::varchar`,
      [nodes, connections, id, versionId],
    );
    console.log('synced', wf.name, versionId);
  }
}
await client.end();
