#!/usr/bin/env node
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

let q = readFileSync(new URL('./_health-probe.sql', import.meta.url), 'utf8');

// Only fix the mangled cfg header
q = q.replace(
  /cfg AS \(\s*SELECT\s*\(SELECT COUNT\(\*\)::int\s+retrieval_stats\.[\s\S]*?FROM settings\) AS settings_count,/,
  `cfg AS (
  SELECT
    (SELECT COUNT(*)::int FROM settings) AS settings_count,`,
);

// Remove wrongly injected select columns that aren't in CTE joins sense at top — if any remain in cfg
// Ensure SELECT list has retrieval columns
if (!q.includes('retrieval_stats.retrieval_mode,')) {
  q = q.replace(
    'qdrant_sync_stats.qdrant_last_sync,',
    `qdrant_sync_stats.qdrant_last_sync,
  retrieval_stats.retrieval_mode,
  retrieval_stats.retrieval_version,
  retrieval_stats.retrieval_drafts,
  retrieval_stats.retrieval_published,
  retrieval_stats.retrieval_avg_rerank_ms,
  retrieval_stats.retrieval_fallback_count,
  retrieval_stats.retrieval_avg_candidates,
  retrieval_stats.retrieval_avg_final,
  retrieval_stats.retrieval_last_validation,`,
  );
}

if (!q.includes('CROSS JOIN retrieval_stats')) {
  q = q.replace(
    'CROSS JOIN qdrant_sync_stats',
    'CROSS JOIN qdrant_sync_stats\nCROSS JOIN retrieval_stats',
  );
}

writeFileSync(new URL('./_health-final.sql', import.meta.url), q);

const r = await client.query(q);
const row = r.rows[0];
console.log('SQL OK', {
  mode: row.retrieval_mode,
  version: row.retrieval_version,
  qdrant: row.qdrant_synced,
  emb: row.embedding_valid,
  eval: row.ai_eval_cases_count,
  settings: row.settings_count,
});

const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
nodes.find((n) => n.name === 'Probe database').parameters.query = q;

const prep = nodes.find((n) => n.parameters?.jsCode?.includes('dbItem'));
const agg = nodes.find((n) => n.name === 'Aggregate health');
if (prep && !prep.parameters.jsCode.includes('retrievalDb')) {
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    /const qdrantDb =/,
    `const retrievalDb = {
      mode: dbItem.retrieval_mode || 'HYBRID',
      version: dbItem.retrieval_version || 'hybrid-v1',
      drafts: Number(dbItem.retrieval_drafts ?? 0) || 0,
      published: Number(dbItem.retrieval_published ?? 0) || 0,
      avgRerankMs: dbItem.retrieval_avg_rerank_ms != null ? Number(dbItem.retrieval_avg_rerank_ms) : null,
      fallbackCount: Number(dbItem.retrieval_fallback_count ?? 0) || 0,
      avgCandidates: dbItem.retrieval_avg_candidates != null ? Number(dbItem.retrieval_avg_candidates) : null,
      avgFinal: dbItem.retrieval_avg_final != null ? Number(dbItem.retrieval_avg_final) : null,
      lastValidationAt: dbItem.retrieval_last_validation || null,
      available: true,
    };
const qdrantDb =`,
  );
  if (!prep.parameters.jsCode.includes('retrievalDb,')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace('qdrantDb,', 'qdrantDb,\n      retrievalDb,');
  }
}
if (agg && !agg.parameters.jsCode.includes('retrieval:')) {
  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    'qdrant:',
    `retrieval: (() => {
    const r = partial.retrievalDb || {};
    const fallbacks = Number(r.fallbackCount || 0);
    return {
      status: fallbacks >= 20 ? 'degraded' : 'up',
      mode: r.mode || 'HYBRID',
      activeVersion: r.version || null,
      draftsCount: Number(r.drafts || 0),
      avgDurationMs: r.avgRerankMs,
      failures: fallbacks,
      lastRunAt: r.lastValidationAt || null,
      online: true,
    };
  })(),
  qdrant:`,
  );
}

await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='qAyYc9DrHIqe4L9i'`, [
  JSON.stringify(nodes),
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$2`,
    [JSON.stringify(nodes), rows[0].activeVersionId],
  );
}
console.log('updated', {
  prep: !!prep?.parameters.jsCode.includes('retrievalDb'),
  agg: !!agg?.parameters.jsCode.includes('retrieval:'),
});
await client.end();
