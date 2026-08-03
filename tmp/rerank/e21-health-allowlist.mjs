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
let changed = 0;
for (const n of nodes) {
  const code = n.parameters?.jsCode;
  if (!code || !code.includes('allowedCompKeys')) continue;
  if (code.includes("'retrievalPipeline'")) {
    console.log('already has retrievalPipeline in', n.name);
    continue;
  }
  let next = code;
  if (code.includes("'retrieval']")) {
    next = next.replace("'retrieval']", "'retrieval','retrievalPipeline']");
  } else if (code.includes("'qdrant']")) {
    next = next.replace("'qdrant']", "'qdrant','retrieval','retrievalPipeline']");
  }
  if (!next.includes("key === 'retrievalPipeline'")) {
    const mapping = `if (key === 'retrievalPipeline') {
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
    if (next.includes("if (key === 'retrieval')")) {
      next = next.replace("if (key === 'retrieval')", mapping + "if (key === 'retrieval')");
    } else if (next.includes("if (key === 'qdrant')")) {
      next = next.replace("if (key === 'qdrant')", mapping + "if (key === 'qdrant')");
    }
  }
  if (next !== code) {
    n.parameters.jsCode = next;
    changed += 1;
    console.log('patched', n.name);
  }
}
if (changed) {
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='2UPHcxASp2PboC9M' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
}
console.log('changed', changed);
await client.end();
