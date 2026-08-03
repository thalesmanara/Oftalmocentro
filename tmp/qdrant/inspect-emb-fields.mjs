import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['WCwJqtFRROwoToik', 'rHDMICvU4BPvduhf', 'BP5ofN6BV3l3mryJ']) {
  const { rows } = await c.query(`SELECT name, nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  const n = rows[0].nodes.find((x) => x.type === 'n8n-nodes-base.postgres' && /SELECT/i.test(x.parameters?.query || ''));
  const q = n?.parameters?.query || '';
  console.log('\n', rows[0].name, 'embeddingAvg?', /embeddingAvgMs/.test(q), 'qdrant?', /qdrantSyncStatus/.test(q));
  const idx = q.indexOf('embeddingAvgMs');
  console.log(q.slice(Math.max(0, idx - 40), idx + 120));
}
await c.end();
