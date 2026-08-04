import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const c = new pg.Client({ connectionString: PG, ssl: false });
await c.connect();

// Find active webhook workflows whose Respond body is ={{ $json }} (sends wrapper)
const { rows } = await c.query(`
  SELECT id, name, active, nodes, connections, "versionId", "activeVersionId"
  FROM workflow_entity
  WHERE active = true
    AND (
      nodes::text LIKE '%"responseBody":"={{ $json }}"%'
      OR nodes::text LIKE '%"responseBody": "={{ $json }}"%'
    )
  ORDER BY name
`);

console.log('candidates', rows.length);
for (const r of rows) console.log('-', r.id, r.name);

function fixRespondNodes(nodes) {
  let changed = 0;
  for (const n of nodes) {
    if (n.type !== 'n8n-nodes-base.respondToWebhook') continue;
    const body = n.parameters?.responseBody;
    if (body === '={{ $json }}') {
      n.parameters.responseBody = '={{ $json.response != null ? $json.response : $json }}';
      // Prefer dynamic status from wrapper when present
      if (!n.parameters.options) n.parameters.options = {};
      if (n.parameters.options.responseCode == null && !String(n.name).includes('401') && !String(n.name).includes('403')) {
        n.parameters.options.responseCode = '={{ $json.statusCode || 200 }}';
      }
      changed++;
    }
  }
  return changed;
}

for (const wf of rows) {
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : structuredClone(wf.nodes);
  const changed = fixRespondNodes(nodes);
  if (!changed) {
    console.log('skip (no match after parse)', wf.name);
    continue;
  }
  const versionId = randomUUID();
  await c.query(
    `INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, name, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4::json,$5::json,$6,NOW(),NOW())`,
    [
      versionId,
      wf.id,
      'system-fix-respond-envelope',
      JSON.stringify(nodes),
      JSON.stringify(wf.connections),
      wf.name,
    ],
  );
  await c.query(
    `UPDATE workflow_entity
     SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW()
     WHERE id=$3`,
    [JSON.stringify(nodes), versionId, wf.id],
  );
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [wf.id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [wf.id]);
  console.log('fixed', changed, 'respond node(s) in', wf.name);
}

await c.end();
