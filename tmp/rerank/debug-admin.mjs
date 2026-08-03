#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const runs = await client.query(
  `SELECT id, overall_score, retrieval_mode, retrieval_config_version, status, started_at
   FROM ai_test_runs ORDER BY started_at DESC LIMIT 5`,
);
console.log('runs', runs.rows);

const { rows } = await client.query(
  `SELECT nodes, connections FROM workflow_entity WHERE id='SxDfJMFCQbytHHL6'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
writeFileSync(
  new URL('./_get-retrieval-nodes.json', import.meta.url),
  JSON.stringify(
    nodes.map((n) => ({
      name: n.name,
      type: n.type,
      query: n.parameters?.query?.slice?.(0, 200),
      path: n.parameters?.path,
      js: n.parameters?.jsCode?.slice?.(0, 150),
    })),
    null,
    2,
  ),
);
console.log('GET nodes', nodes.map((n) => n.name));

// Check webhook registration
const wh = await client.query(
  `SELECT "webhookPath", method, "workflowId" FROM webhook_entity WHERE "workflowId" IN ('SxDfJMFCQbytHHL6','CkX6dJ0bYtow2nU6') OR "webhookPath" ILIKE '%ai-retrieval%' OR "webhookPath" ILIKE '%ai-prompts'`,
).catch((e) => ({ rows: [{ err: e.message }] }));
console.log('webhooks', wh.rows);

// Compare prompt GET connections
const p = await client.query(`SELECT connections FROM workflow_entity WHERE id='CkX6dJ0bYtow2nU6'`);
const r = await client.query(`SELECT connections FROM workflow_entity WHERE id='SxDfJMFCQbytHHL6'`);
writeFileSync(new URL('./_get-retrieval-conn.json', import.meta.url), JSON.stringify({
  prompts: p.rows[0].connections,
  retrieval: r.rows[0].connections,
}, null, 2));

await client.end();
