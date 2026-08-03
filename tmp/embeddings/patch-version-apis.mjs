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
  const needle = '  (dv.table_preview IS NOT NULL) AS "hasTablePreview"\nFROM document_versions';
  const repl =
    '  (dv.table_preview IS NOT NULL) AS "hasTablePreview",\n' +
    embFields +
    '\nFROM document_versions';
  if (q.includes(needle)) return q.replace(needle, repl);
  // fallback: insert before FROM document_versions after hasTablePreview line
  return q.replace(
    /( \(dv\.table_preview IS NOT NULL\) AS "hasTablePreview")(\r?\nFROM document_versions)/,
    `$1,\n${embFields}$2`,
  );
}

for (const id of ['rHDMICvU4BPvduhf', 'BP5ofN6BV3l3mryJ']) {
  const { rows } = await c.query('SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1', [
    id,
  ]);
  const nodes = rows[0].nodes;
  let changed = false;
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query) {
      const before = n.parameters.query;
      const after = patchQuery(before);
      if (after !== before) {
        n.parameters.query = after;
        changed = true;
        console.log(id, n.name, 'patched', /embeddingStatus/.test(after));
      } else {
        console.log(id, n.name, 'NO CHANGE');
        console.log(JSON.stringify(before.slice(-200)));
      }
    }
  }
  if (changed) {
    await c.query(
      'UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2',
      [JSON.stringify(nodes), id],
    );
    if (rows[0].activeVersionId) {
      await c.query(
        'UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3',
        [JSON.stringify(nodes), id, rows[0].activeVersionId],
      );
      console.log(id, 'history synced');
    }
  }
}
await c.end();
