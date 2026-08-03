#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const sample = await client.query(
  `SELECT * FROM webhook_entity WHERE "workflowId"='7995896871ed4947'`,
);
console.log(JSON.stringify(sample.rows, null, 2));

const ids = [
  ['c22CacheList0000001', 'GET', 'system/ai-cache'],
  ['c22CacheDetail00001', 'GET', 'system/ai-cache/detail'],
  ['c22CacheCreate00001', 'POST', 'system/ai-cache/create'],
  ['c22CacheValidate001', 'POST', 'system/ai-cache/validate'],
  ['c22CachePublish0001', 'POST', 'system/ai-cache/publish'],
  ['c22CacheRollback001', 'POST', 'system/ai-cache/rollback'],
  ['c22CacheInvalidate01', 'POST', 'system/ai-cache/invalidate'],
  ['c22CacheCleanup0001', 'POST', 'system/ai-cache/cleanup'],
  ['c22CacheCompare0001', 'GET', 'system/ai-cache/compare'],
  ['c22CacheUpdate00001', 'PUT', 'system/ai-cache/update'],
];

for (const [wfId, method, path] of ids) {
  const { rows } = await client.query(`SELECT nodes, active FROM workflow_entity WHERE id=$1`, [wfId]);
  if (!rows[0]) {
    console.log('missing wf', wfId);
    continue;
  }
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  const webhookId = wh?.webhookId || wh?.id;
  const nodeName = wh?.name || 'Webhook';
  const pathLength = path.split('/').length;
  await client.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [wfId]);
  await client.query(
    `INSERT INTO webhook_entity ("workflowId", "webhookPath", method, node, "webhookId", "pathLength")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    [wfId, path, method, nodeName, webhookId, pathLength],
  );
  // some n8n versions use unique on webhookPath+method
  console.log('registered', method, path, webhookId);
}

const check = await client.query(
  `SELECT method, "webhookPath", "workflowId" FROM webhook_entity WHERE "webhookPath" LIKE 'system/ai-cache%' ORDER BY 2`,
);
console.log('registered rows', check.rows);
await client.end();
