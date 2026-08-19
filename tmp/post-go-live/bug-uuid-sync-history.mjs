import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const id = 'WLlD1eqbFmKDK9ow';
const { rows } = await c.query(
  `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
  [id],
);
const row = rows[0];
const res = await c.query(
  `UPDATE workflow_history
   SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
   WHERE "workflowId" = $3 AND "versionId" = $4`,
  [JSON.stringify(row.nodes), JSON.stringify(row.connections), id, row.activeVersionId],
);
const sqlNode = row.nodes.find((n) => n.name === 'Execute a SQL query');
const vp = row.nodes.find((n) => n.name === 'Validar payload');
const q = String(sqlNode?.parameters?.query || '');
console.log(
  JSON.stringify(
    {
      name: row.name,
      activeVersionId: row.activeVersionId,
      historyUpdated: res.rowCount,
      sqlUsesWebhook: q.includes("$('Webhook')"),
      sqlUsesJsonBody: /\$json\.body/.test(q),
      hasIsActive: q.includes('is_active'),
      vpValidatesUuid: String(vp?.parameters?.jsCode || '').includes('uuidRe'),
    },
    null,
    2,
  ),
);
await c.end();
