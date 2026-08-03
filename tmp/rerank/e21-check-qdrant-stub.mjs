#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const id = 'YDnrXjzYUOrZVE6N';
const { rows } = await client.query(
  `SELECT id, name, active, "activeVersionId", nodes FROM workflow_entity WHERE id=$1`,
  [id],
);
const wf = rows[0];
const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
const names = nodes.map((n) => n.name);
let histNames = null;
let histHasStub = null;
if (wf.activeVersionId) {
  const h = await client.query(
    `SELECT nodes FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
    [id, wf.activeVersionId],
  );
  const hn = typeof h.rows[0]?.nodes === 'string' ? JSON.parse(h.rows[0].nodes) : h.rows[0]?.nodes;
  histNames = hn?.map((n) => n.name);
  histHasStub = histNames?.includes('Stub');
  // check if Normalizar returns STUB in history
  const norm = hn?.find((n) => n.name === 'Normalizar hits' || n.name === 'Stub');
  writeFileSync(
    new URL('./_e21-qdrant-hist-norm.txt', import.meta.url),
    norm ? JSON.stringify(norm, null, 2).slice(0, 3000) : 'no norm',
  );
}

console.log(
  JSON.stringify(
    {
      active: wf.active,
      activeVersionId: wf.activeVersionId,
      entityNames: names,
      entityHasStub: names.includes('Stub'),
      histNames,
      histHasStub,
    },
    null,
    2,
  ),
);
await client.end();
