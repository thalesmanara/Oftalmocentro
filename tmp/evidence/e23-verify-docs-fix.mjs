import pg from 'pg';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const WF = 'WCwJqtFRROwoToik';
const c = new pg.Client({ connectionString: PG, ssl: false });
await c.connect();

const meta = await c.query(
  `SELECT id, name, active, "versionId", "activeVersionId", "updatedAt" FROM workflow_entity WHERE id=$1`,
  [WF],
);
console.log('meta', meta.rows[0]);

const wf = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [WF]);
const nodes = typeof wf.rows[0].nodes === 'string' ? JSON.parse(wf.rows[0].nodes) : wf.rows[0].nodes;
const sqlNode = nodes.find((n) => n.name === 'Execute a SQL query');
const q = sqlNode?.parameters?.query || '';
const idx = q.indexOf('qdrantSyncedAt');
console.log('snippet around qdrantSyncedAt:\n', q.slice(idx, idx + 80));
console.log('has trailing comma before FROM?', /qdrantSyncedAt\",\s*\nFROM/.test(q) || /qdrantSyncedAt",\nFROM/.test(q));

// Check if activeVersion matches
if (meta.rows[0].activeVersionId) {
  const ver = await c.query(
    `SELECT id, "versionId", "createdAt" FROM workflow_history WHERE "workflowId"=$1 ORDER BY "createdAt" DESC LIMIT 3`,
    [WF],
  ).catch(async () => {
    // try alternate table
    return c.query(
      `SELECT id, version_id AS "versionId", created_at AS "createdAt" FROM workflow_history WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT 3`,
      [WF],
    );
  });
  console.log('history', ver.rows);
}

await c.end();
