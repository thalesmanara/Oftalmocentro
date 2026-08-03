import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['8EXk5RkFW5cxnenL', 'vNDpCzOdR7ATnHDP', 'WCwJqtFRROwoToik', 'rHDMICvU4BPvduhf']) {
  const { rows } = await c.query(
    `SELECT name, nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const names = rows[0].nodes.map((n) => n.name);
  const { rows: h } = await c.query(
    `SELECT nodes FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
    [id, rows[0].activeVersionId],
  );
  const hn = h[0]?.nodes?.map((n) => n.name) || [];
  const q = JSON.stringify(rows[0].nodes);
  console.log(
    rows[0].name,
    'draft:Merge',
    names.includes('Merge híbrido'),
    'draft:QdrantOrq',
    names.includes('Chamar QDRANT - ORQUESTRAR'),
    'hist:Merge',
    hn.includes('Merge híbrido'),
    'hist:QdrantOrq',
    hn.includes('Chamar QDRANT - ORQUESTRAR'),
    'qdrantSyncStatus field',
    /qdrantSyncStatus/.test(q),
  );
}
await c.end();
