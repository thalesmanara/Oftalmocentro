#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.name === 'Montar resposta admin');
let code = n.parameters.jsCode;

const block = `
  if (key === 'qdrant') {
    if (typeof c.online === 'boolean') out.online = c.online;
    if (c.collection) out.collection = c.collection;
    if (typeof c.total === 'number') out.total = c.total;
    if (typeof c.pending === 'number') out.pending = c.pending;
    if (typeof c.failures === 'number') out.failures = c.failures;
    if (c.avgDurationMs != null) out.avgDurationMs = Number(c.avgDurationMs);
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
    if (c.model) out.model = c.model;
  }
  if (key === 'retrieval') {
    out.mode = c.mode || null;
    out.activeVersion = c.activeVersion || null;
    out.draftsCount = Number(c.draftsCount || 0) || 0;
    out.avgDurationMs = c.avgDurationMs != null ? Number(c.avgDurationMs) : null;
    out.failures = Number(c.failures || 0) || 0;
    out.online = c.online !== false;
    if (typeof c.pending === 'number') out.pending = c.pending;
    if (typeof c.queue === 'number') out.queue = c.queue;
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
    if (c.details && typeof c.details === 'object') out.details = c.details;
  }
  if (key === 'retrievalPipeline') {
    out.activeMode = c.activeMode || c.mode || null;
    out.activeVersion = c.activeVersion || null;
    out.textSearchAvailable = c.textSearchAvailable !== false;
    out.vectorSearchAvailable = c.vectorSearchAvailable !== false;
    out.rerankAvailable = c.rerankAvailable !== false;
    out.avgRetrievalLatencyMs = c.avgRetrievalLatencyMs != null ? Number(c.avgRetrievalLatencyMs) : null;
    out.avgRerankLatencyMs = c.avgRerankLatencyMs != null ? Number(c.avgRerankLatencyMs) : null;
    out.fallbackCount7d = Number(c.fallbackCount7d || 0) || 0;
    out.failureCount7d = Number(c.failureCount7d || 0) || 0;
    out.avgCandidates = c.avgCandidates != null ? Number(c.avgCandidates) : null;
    out.avgSelected = c.avgSelected != null ? Number(c.avgSelected) : null;
    if (c.lastSuccessfulRetrieval) out.lastSuccessfulRetrieval = c.lastSuccessfulRetrieval;
    if (c.lastDatasetValidation) out.lastDatasetValidation = c.lastDatasetValidation;
  }
`;

if (!code.includes("key === 'retrievalPipeline'")) {
  code = code.replace('  components[key] = out;', block + '\n  components[key] = out;');
} else {
  // replace existing incomplete section by ensuring block before components[key]
  code = code.replace(/if \(key === 'qdrant'\) \{[\s\S]*?components\[key\] = out;/, 'components[key] = out;');
  code = code.replace('  components[key] = out;', block + '\n  components[key] = out;');
}

// ensure allowlist keys
if (!code.includes("'retrievalPipeline'")) {
  code = code.replace("'qdrant']", "'qdrant','retrieval','retrievalPipeline']");
  if (!code.includes("'retrieval'")) {
    /* already handled */
  }
}

n.parameters.jsCode = code;
await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`, [
  JSON.stringify(nodes),
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='2UPHcxASp2PboC9M' AND "versionId"=$2`,
    [JSON.stringify(nodes), rows[0].activeVersionId],
  );
}
console.log({
  hasQdrant: code.includes("key === 'qdrant'"),
  hasRetrieval: code.includes("key === 'retrieval'"),
  hasPipeline: code.includes("key === 'retrievalPipeline'"),
  allow: code.includes("'retrievalPipeline'"),
});
await client.end();
