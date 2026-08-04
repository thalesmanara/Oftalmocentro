#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`
  SELECT id, name, active, "versionId", "activeVersionId",
    EXISTS (SELECT 1 FROM workflow_history h WHERE h."workflowId"=w.id AND h."versionId"=w."activeVersionId") AS hist_ok
  FROM workflow_entity w WHERE active=true ORDER BY name`);
writeFileSync(
  new URL('./workflows-final.json', import.meta.url),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      count: rows.length,
      historyIssues: rows.filter((r) => !r.hist_ok).map((r) => r.name),
      workflows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        active: r.active,
        hist_ok: r.hist_ok,
      })),
    },
    null,
    2,
  ),
);
console.log('active', rows.length, 'historyIssues', rows.filter((r) => !r.hist_ok).length);
await c.end();
