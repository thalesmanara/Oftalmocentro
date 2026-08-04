#!/usr/bin/env node
/** Etapa 27 — sync workflow_history for AUTH - VALIDATE if mismatched */
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(`
  SELECT id, name, nodes, connections, "versionId", "activeVersionId", active
  FROM workflow_entity
  WHERE name ILIKE '%AUTH%VALIDATE%' OR id IN (
    SELECT id FROM workflow_entity WHERE active=true AND (
      "versionId" IS DISTINCT FROM "activeVersionId"
      OR NOT EXISTS (
        SELECT 1 FROM workflow_history h
        WHERE h."workflowId"=workflow_entity.id AND h."versionId"=workflow_entity."activeVersionId"
      )
    )
  )
`);

for (const w of rows) {
  const versionId = randomUUID();
  const nodes = typeof w.nodes === 'string' ? w.nodes : JSON.stringify(w.nodes);
  const connections =
    typeof w.connections === 'string' ? w.connections : JSON.stringify(w.connections);
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa27',$3::json,$4::json,$5,'e27 history sync',false,NOW(),NOW())`,
    [versionId, w.id, nodes, connections, w.name],
  );
  await c.query(
    `UPDATE workflow_entity SET "versionId"=$1::varchar, "activeVersionId"=$1::varchar, "updatedAt"=NOW() WHERE id=$2`,
    [versionId, w.id],
  );
  await c.query('COMMIT');
  if (w.active) {
    await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [w.id]);
    await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [w.id]);
  }
  console.log('synced', w.name, versionId);
}

await c.end();
