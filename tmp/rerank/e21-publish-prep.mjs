#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const RECUPERAR = 'bae8872eeb164a27';
const CONSULTA = '8EXk5RkFW5cxnenL';

async function ensureHistory(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  if (!wf) throw new Error('missing ' + id);
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
  const connections =
    typeof wf.connections === 'string' ? JSON.parse(wf.connections) : wf.connections;

  let versionId = wf.activeVersionId;
  if (!versionId) {
    versionId = randomUUID();
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,$3,$4::json,$5::json,$6,$7,false,NOW(),NOW())`,
      [versionId, id, 'etapa21', JSON.stringify(nodes), JSON.stringify(connections), wf.name, ''],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar, active=true, "updatedAt"=NOW() WHERE id=$2`,
      [versionId, id],
    );
    console.log(wf.name, 'CREATED history', versionId);
  } else {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4::varchar`,
      [JSON.stringify(nodes), JSON.stringify(connections), id, versionId],
    );
    console.log(wf.name, 'SYNCED history', versionId);
  }
  return versionId;
}

const vRec = await ensureHistory(RECUPERAR);
const vCon = await ensureHistory(CONSULTA);
console.log({ vRec, vCon });
await client.end();
