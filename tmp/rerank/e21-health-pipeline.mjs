#!/usr/bin/env node
/**
 * Add retrievalPipeline aggregate view to SYSTEM health Aggregate node.
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ID = 'qAyYc9DrHIqe4L9i';
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [ID],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const agg = nodes.find((n) => n.name === 'Aggregate health');
if (!agg) throw new Error('Aggregate health missing');

if (!agg.parameters.jsCode.includes('retrievalPipeline')) {
  // Insert after retrieval: block or qdrant:
  const block = `retrievalPipeline: (() => {
    const r = partial.retrievalDb || {};
    const q = partial.qdrantDb || partial.components?.qdrant || {};
    const emb = partial.embeddingsDb || {};
    const fallbacks = Number(r.fallbackCount || 0);
    const textOk = true;
    const vectorOk = q.online !== false && (q.status === 'up' || q.status === 'ok' || q.online === true || q.available !== false);
    return {
      status: fallbacks >= 20 ? 'degraded' : 'up',
      activeMode: r.mode || 'HYBRID',
      activeVersion: r.version || 'hybrid-v1',
      textSearchAvailable: textOk,
      vectorSearchAvailable: !!vectorOk,
      rerankAvailable: true,
      avgRetrievalLatencyMs: r.avgRetrievalMs != null ? Number(r.avgRetrievalMs) : null,
      avgRerankLatencyMs: r.avgRerankMs != null ? Number(r.avgRerankMs) : null,
      fallbackCount7d: fallbacks,
      failureCount7d: Number(r.failureCount || 0),
      avgCandidates: r.avgCandidates != null ? Number(r.avgCandidates) : null,
      avgSelected: r.avgFinal != null ? Number(r.avgFinal) : null,
      lastSuccessfulRetrieval: r.lastSuccessAt || null,
      lastDatasetValidation: r.lastValidationAt || null,
    };
  })(),
  `;
  if (agg.parameters.jsCode.includes('retrieval:')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace('retrieval:', block + 'retrieval:');
  } else if (agg.parameters.jsCode.includes('qdrant:')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace('qdrant:', block + 'qdrant:');
  } else {
    throw new Error('no insertion point');
  }
  console.log('added retrievalPipeline');
} else {
  console.log('retrievalPipeline already present');
}

// enrich retrievalDb with avgRetrievalMs if probe has column - optional soft add
const prep = nodes.find((n) => n.parameters?.jsCode?.includes('retrievalDb'));
if (prep && !prep.parameters.jsCode.includes('avgRetrievalMs')) {
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    'avgRerankMs: dbItem.retrieval_avg_rerank_ms != null ? Number(dbItem.retrieval_avg_rerank_ms) : null,',
    `avgRerankMs: dbItem.retrieval_avg_rerank_ms != null ? Number(dbItem.retrieval_avg_rerank_ms) : null,
      avgRetrievalMs: dbItem.retrieval_avg_latency_ms != null ? Number(dbItem.retrieval_avg_latency_ms) : null,
      lastSuccessAt: dbItem.retrieval_last_success || null,
      failureCount: Number(dbItem.retrieval_failure_count ?? 0) || 0,`,
  );
  console.log('enriched retrievalDb');
}

await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(nodes),
  ID,
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), ID, rows[0].activeVersionId],
  );
}
await client.end();
