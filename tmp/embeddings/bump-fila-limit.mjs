import pg from 'pg';

const limit = Number(process.argv[2] || 3);
const client = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const id = '3BkmtrasXs1lORtL';
const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId", "versionId" FROM workflow_entity WHERE id = $1`,
  [id]
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const pick = nodes.find((n) => n.name === 'Pick versões');
if (!pick) throw new Error('Pick versões missing');
pick.parameters.query = `SELECT document_version_id AS "versionId", MIN(document_id::text)::uuid AS "documentId", COUNT(*)::int AS pending
FROM document_chunks
WHERE embedding_status IN ('PENDING','FAILED','INVALID')
  AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())
GROUP BY document_version_id
ORDER BY MIN(COALESCE(embedding_next_retry_at, '-infinity'::timestamptz)), document_version_id
LIMIT ${limit}`;
const nodesJson = JSON.stringify(nodes);
await client.query(
  `UPDATE workflow_entity SET nodes = $1::json, "updatedAt" = NOW() WHERE id = $2`,
  [nodesJson, id]
);
for (const vid of [rows[0].activeVersionId, rows[0].versionId]) {
  if (!vid) continue;
  await client.query(
    `UPDATE workflow_history SET nodes = $1::json, "updatedAt" = NOW()
     WHERE "workflowId" = $2 AND "versionId" = $3`,
    [nodesJson, id, vid]
  );
}
console.log('FILA LIMIT set to', limit);
await client.end();
