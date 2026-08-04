import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const WF = 'WCwJqtFRROwoToik';

const c = new pg.Client({ connectionString: PG, ssl: false });
await c.connect();

const { rows } = await c.query(
  `SELECT id, name, active, nodes, connections, "versionId", "activeVersionId", settings
   FROM workflow_entity WHERE id=$1`,
  [WF],
);
const wf = rows[0];
console.log('before', {
  versionId: wf.versionId,
  activeVersionId: wf.activeVersionId,
  active: wf.active,
});

const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
const sqlNode = nodes.find((n) => n.name === 'Execute a SQL query');
const q = sqlNode?.parameters?.query || '';
if (/,(\s*)\nFROM documents/.test(q) || /SyncedAt\",\nFROM/.test(q)) {
  console.error('SQL still has trailing comma — abort');
  process.exit(1);
}
console.log('SQL looks fixed');

const versionId = wf.versionId || randomUUID();

// Ensure history row exists for this version
const histCols = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='workflow_history' ORDER BY ordinal_position`,
);
console.log(
  'history cols',
  histCols.rows.map((r) => r.column_name),
);

const existingHist = await c.query(
  `SELECT "versionId" FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
  [WF, versionId],
).catch(() => ({ rows: [] }));

if (!existingHist.rows?.length) {
  await c.query(
    `INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::json, $5::json, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [versionId, WF, 'system', JSON.stringify(nodes), JSON.stringify(wf.connections)],
  );
  console.log('inserted workflow_history', versionId);
} else {
  console.log('history already exists', versionId);
}

await c.query(
  `UPDATE workflow_entity
   SET "activeVersionId"=$1::varchar,
       "versionId"=$1::varchar,
       active=true,
       "updatedAt"=NOW()
   WHERE id=$2`,
  [versionId, WF],
);

// Toggle to force webhook reload
await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [WF]);
await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [WF]);

const after = await c.query(
  `SELECT "versionId", "activeVersionId", active FROM workflow_entity WHERE id=$1`,
  [WF],
);
console.log('after', after.rows[0]);
await c.end();
