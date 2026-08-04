import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const IDS = ['rHDMICvU4BPvduhf', 'BP5ofN6BV3l3mryJ'];

const c = new pg.Client({ connectionString: PG, ssl: false });
await c.connect();

function fixTrailingComma(q) {
  return q.replace(/,(\s*\n)FROM\b/g, '$1FROM');
}

for (const id of IDS) {
  const { rows } = await c.query(
    `SELECT id, name, active, nodes, connections, "versionId", "activeVersionId"
     FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : structuredClone(wf.nodes);
  let changed = false;
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && typeof n.parameters?.query === 'string') {
      const after = fixTrailingComma(n.parameters.query);
      if (after !== n.parameters.query) {
        n.parameters.query = after;
        changed = true;
        console.log('will fix', wf.name, n.name);
      }
    }
  }
  if (!changed) {
    console.log('already clean', wf.name);
    continue;
  }

  const versionId = randomUUID();
  // history first (FK on activeVersionId)
  await c.query(
    `INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, name, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::json, $5::json, $6, NOW(), NOW())`,
    [
      versionId,
      id,
      'system-fix-trailing-comma',
      JSON.stringify(nodes),
      JSON.stringify(wf.connections),
      wf.name,
    ],
  );
  await c.query(
    `UPDATE workflow_entity
     SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW()
     WHERE id=$3`,
    [JSON.stringify(nodes), versionId, id],
  );
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [id]);
  console.log('activated', wf.name, versionId);
}

await c.end();
