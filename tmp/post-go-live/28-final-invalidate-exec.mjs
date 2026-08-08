import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const cols = (
  await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='execution_entity' ORDER BY 1`,
  )
).rows.map((r) => r.column_name);

const recent = (
  await c.query(
    `SELECT id, "workflowId", status, mode, "startedAt"
     FROM execution_entity
     WHERE "startedAt" > NOW() - INTERVAL '2 hours'
     ORDER BY "startedAt" DESC
     LIMIT 40`,
  )
).rows;

const byWf = (
  await c.query(
    `SELECT "workflowId", COUNT(*)::int AS n, MAX("startedAt") AS last
     FROM execution_entity
     WHERE "startedAt" > NOW() - INTERVAL '2 hours'
     GROUP BY 1 ORDER BY n DESC LIMIT 30`,
  )
).rows;

const invNode = (
  await c.query(
    `SELECT n->>'name' AS name, n->'parameters' AS params
     FROM workflow_entity w,
          LATERAL jsonb_array_elements(w.nodes::jsonb) n
     WHERE w.id='Y0MuWEEdoMFts7ay' AND n->>'name'='Invalidar cache'`,
  )
).rows[0];

const invWfNodes = (
  await c.query(
    `SELECT jsonb_agg(jsonb_build_object('name', n->>'name', 'type', n->>'type')) AS nodes
     FROM workflow_entity w,
          LATERAL jsonb_array_elements(w.nodes::jsonb) n
     WHERE w.id='c221InvalidateEvent01'`,
  )
).rows[0];

writeFileSync(
  'tmp/post-go-live/28-final-invalidate-exec.json',
  JSON.stringify({ cols, recent, byWf, invNode, invWfNodes }, null, 2),
);
console.log(
  JSON.stringify(
    {
      cols,
      invNode,
      invRecent: recent.filter((r) => r.workflowId === 'c221InvalidateEvent01'),
      putRecent: recent.filter((r) => r.workflowId === 'Y0MuWEEdoMFts7ay').slice(0, 5),
      top: byWf.slice(0, 15),
    },
    null,
    2,
  ),
);
await c.end();
