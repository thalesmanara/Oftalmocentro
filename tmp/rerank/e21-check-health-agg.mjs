#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const agg = nodes.find((n) => n.name === 'Aggregate health');
const code = agg?.parameters?.jsCode || '';
writeFileSync(new URL('./_e21-health-agg.js', import.meta.url), code);
console.log({
  hasPipeline: code.includes('retrievalPipeline'),
  hasRetrieval: code.includes('retrieval:'),
  activeVersionId: rows[0].activeVersionId,
  idx: code.indexOf('retrievalPipeline'),
  snippet: code.slice(Math.max(0, code.indexOf('retrievalPipeline') - 80), code.indexOf('retrievalPipeline') + 400),
});

// sync history
await client.query(
  `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$2`,
  [JSON.stringify(nodes), rows[0].activeVersionId],
);
console.log('synced health history');
await client.end();
