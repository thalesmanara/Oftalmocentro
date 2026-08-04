import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const qdrantFields = [
  '  dv.qdrant_sync_status AS "qdrantSyncStatus",',
  '  dv.qdrant_synced_count AS "qdrantSyncedCount",',
  '  dv.qdrant_pending_count AS "qdrantPendingCount",',
  '  dv.qdrant_failed_count AS "qdrantFailedCount",',
  '  dv.qdrant_collection AS "qdrantCollection",',
  '  dv.qdrant_synced_at AS "qdrantSyncedAt"',
].join('\n');

function patchQuery(q) {
  if (/qdrant_sync_status/i.test(q)) {
    // Repair accidental trailing comma before FROM from earlier patch runs.
    return q.replace(/,(\s*\n)FROM\b/g, '$1FROM');
  }
  if (!/embedding_avg_ms AS "embeddingAvgMs"/i.test(q)) return q;
  return q.replace(
    /dv\.embedding_avg_ms AS "embeddingAvgMs",\r?\nFROM /g,
    `dv.embedding_avg_ms AS "embeddingAvgMs",\n${qdrantFields}\nFROM `,
  );
}

for (const id of ['WCwJqtFRROwoToik', 'rHDMICvU4BPvduhf', 'BP5ofN6BV3l3mryJ']) {
  const { rows } = await c.query('SELECT nodes, "activeVersionId", name FROM workflow_entity WHERE id=$1', [
    id,
  ]);
  const nodes = rows[0].nodes;
  let changed = false;
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query) {
      const after = patchQuery(n.parameters.query);
      if (after !== n.parameters.query) {
        n.parameters.query = after;
        changed = true;
        console.log('patched', rows[0].name, /qdrantSyncStatus/.test(after));
      }
    }
  }
  if (changed) {
    await c.query('UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2', [
      JSON.stringify(nodes),
      id,
    ]);
    if (rows[0].activeVersionId) {
      await c.query(
        'UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3',
        [JSON.stringify(nodes), id, rows[0].activeVersionId],
      );
    }
  }
}
await c.end();
