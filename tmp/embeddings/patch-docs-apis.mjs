import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const embFields = [
  '  dv.embedding_status AS "embeddingStatus",',
  '  dv.embedding_model AS "embeddingModel",',
  '  dv.embedding_dimensions AS "embeddingDimensions",',
  '  dv.embedding_pending_count AS "embeddingPendingCount",',
  '  dv.embedding_valid_count AS "embeddingValidCount",',
  '  dv.embedding_failed_count AS "embeddingFailedCount",',
  '  dv.embedding_completed_at AS "embeddingCompletedAt",',
  '  dv.embedding_avg_ms AS "embeddingAvgMs",',
].join('\n');

function patchQuery(q) {
  if (/embedding_status/i.test(q)) return q;
  return q.replace(
    /( \(dv\.table_preview IS NOT NULL\) AS "hasTablePreview")(\r?\nFROM )/g,
    `$1,\n${embFields}$2`,
  );
}

const { rows: wfRows } = await c.query(
  `SELECT id, name, nodes, "activeVersionId" FROM workflow_entity
   WHERE active = true AND (
     id = 'WCwJqtFRROwoToik'
     OR name ILIKE 'GET Document%'
     OR name ILIKE 'GET Documento%'
   )`,
);

for (const r of wfRows) {
  const nodes = r.nodes;
  let changed = false;
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query) {
      const before = n.parameters.query;
      if (!/hasTablePreview/.test(before)) continue;
      const after = patchQuery(before);
      if (after !== before) {
        n.parameters.query = after;
        changed = true;
        console.log('patched', r.id, r.name, n.name);
      }
    }
  }
  if (changed) {
    await c.query(
      'UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2',
      [JSON.stringify(nodes), r.id],
    );
    if (r.activeVersionId) {
      await c.query(
        'UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3',
        [JSON.stringify(nodes), r.id, r.activeVersionId],
      );
      console.log('history', r.id);
    }
  }
}
await c.end();
