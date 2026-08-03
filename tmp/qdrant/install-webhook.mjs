#!/usr/bin/env node
/** Create POST System Qdrant Reindex webhook from embeddings reprocess template */
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const IDS = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes, connections, settings FROM workflow_entity WHERE id='A3ps15dPHWoN2LZf'`
);
let nodes = JSON.parse(JSON.stringify(rows[0].nodes));
let connections = JSON.parse(JSON.stringify(rows[0].connections));

for (const n of nodes) {
  n.id = randomUUID();
  if (n.name === 'Webhook') {
    n.parameters.path = 'system/qdrant/reindex';
  }
  if (n.type === 'n8n-nodes-base.executeWorkflow') {
    const wid = n.parameters?.workflowId?.value;
    const cached = n.parameters?.workflowId?.cachedResultName || '';
    if (cached.includes('EMBEDDING') || cached.includes('REPROCESSAR') || wid === 'x4bw9IQ5vwJSFh0y' || wid === 'LJQZ2HrG6qJGN0Q2') {
      n.parameters.workflowId = {
        __rl: true,
        mode: 'id',
        value: IDS.REINDEXAR,
        cachedResultName: 'QDRANT - REINDEXAR',
      };
      // map inputs for reindex
      if (n.parameters.workflowInputs?.value) {
        n.parameters.workflowInputs.value = {
          scope: "={{ $json.body?.scope || $json.scope || 'document' }}",
          versionId: "={{ $json.body?.versionId || $json.versionId || '' }}",
          documentId: "={{ $json.body?.documentId || $json.documentId || '' }}",
          chunkId: "={{ $json.body?.chunkId || $json.chunkId || '' }}",
          requestId: "={{ $json.requestId || '' }}",
          userId: "={{ $json.userId || '' }}",
          sessionId: "={{ $json.sessionId || '' }}",
          force: true,
        };
      }
      n.name = n.name.replace(/Embedding|EMBEDDING|Reprocess/gi, (m) =>
        m.toLowerCase().includes('embed') ? 'Qdrant' : m
      );
      if (/reprocess|orquestrar|chamar/i.test(n.name)) n.name = 'Chamar QDRANT - REINDEXAR';
    }
  }
  if (typeof n.parameters?.path === 'string' && n.parameters.path.includes('embeddings')) {
    n.parameters.path = n.parameters.path.replace('embeddings/reprocess', 'qdrant/reindex');
  }
}

// Fix connection keys if node renamed
const json = JSON.stringify(connections).replace(/Chamar EMBEDDING - REPROCESSAR/g, 'Chamar QDRANT - REINDEXAR');
connections = JSON.parse(json);

const name = 'POST System Qdrant Reindex';
const { rows: existing } = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name=$1`, [name]);
if (existing[0]) {
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(nodes), JSON.stringify(connections), existing[0].id,
  ]);
  if (existing[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), existing[0].id, existing[0].activeVersionId]
    );
  }
  IDS.WEBHOOK_REINDEX = existing[0].id;
  console.log('updated', existing[0].id);
} else {
  // create via copying entity shell from template
  const wfId = [...Array(16)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');
  const versionId = randomUUID();
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "staticData", "pinData", "versionId", "triggerCount", "meta", "parentFolderId", "createdAt", "updatedAt", "isArchived", "versionCounter", "activeVersionId")
     VALUES ($1::varchar,$2::varchar,false,$3::json,$4::json,$5::json,'{}'::json,'{}'::json,$6::varchar,1,'{}'::json,NULL,$7::timestamptz,$7::timestamptz,false,1,NULL)`,
    [wfId, name, JSON.stringify(nodes), JSON.stringify(connections), JSON.stringify(rows[0].settings || { executionOrder: 'v1' }), versionId, now]
  );
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",nodes,connections,authors,"createdAt","updatedAt")
     VALUES ($1::varchar,$2::varchar,$3::json,$4::json,'system',$5::timestamptz,$5::timestamptz)`,
    [versionId, wfId, JSON.stringify(nodes), JSON.stringify(connections), now]
  );
  await client.query(`UPDATE workflow_entity SET "activeVersionId"=$1::varchar, active=true WHERE id=$2::varchar`, [versionId, wfId]);
  try {
    await client.query(
      `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
       SELECT $1::varchar, id, 'workflow:owner', NOW(), NOW() FROM project WHERE id='WbvMM1wAedTR9qrk' LIMIT 1 ON CONFLICT DO NOTHING`,
      [wfId]
    );
  } catch (e) {
    console.log('share warn', e.message);
  }
  IDS.WEBHOOK_REINDEX = wfId;
  console.log('created', wfId);
}

IDS.SCHEDULE = 'By7xP0i0JmWy1AZD';
writeFileSync(new URL('./workflow-ids.json', import.meta.url), JSON.stringify(IDS, null, 2));
await client.end();
