#!/usr/bin/env node
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

let q = readFileSync(new URL('./_health-probe.sql', import.meta.url), 'utf8');

// Fix mangled cfg block at start
q = q.replace(
  /cfg AS \(\s*SELECT\s*\(SELECT COUNT\(\*\)::int\s+retrieval_stats\.[\s\S]*?FROM settings\) AS settings_count,/,
  `cfg AS (
  SELECT
    (SELECT COUNT(*)::int FROM settings) AS settings_count,`,
);

// Remove any inline retrieval select garbage if still present
q = q.replace(/retrieval_stats\.retrieval_[a-z_]+\s*(AS\s+[a-z_]+)?,\s*/g, '');

// Ensure retrieval CTE exists once before qdrant_sync_stats
const retrievalCte = `retrieval_stats AS (
  SELECT
    COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1),'HYBRID') AS retrieval_mode,
    COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1),'hybrid-v1') AS retrieval_version,
    (SELECT COUNT(*)::int FROM ai_retrieval_config_versions WHERE status='DRAFT') AS retrieval_drafts,
    (SELECT COUNT(*)::int FROM ai_retrieval_config_versions WHERE status='PUBLISHED') AS retrieval_published,
    (SELECT AVG(rerank_latency_ms)::int FROM ai_test_results WHERE rerank_latency_ms IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_rerank_ms,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE fallback_used=true AND created_at > NOW() - INTERVAL '7 days') AS retrieval_fallback_count,
    (SELECT AVG(candidates_retrieved)::numeric FROM ai_test_results WHERE candidates_retrieved IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_candidates,
    (SELECT AVG(final_context_count)::numeric FROM ai_test_results WHERE final_context_count IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_final,
    (SELECT MAX(started_at) FROM ai_test_runs WHERE retrieval_config_version IS NOT NULL) AS retrieval_last_validation
),
`;

if (!q.includes('retrieval_stats AS (')) {
  q = q.replace('qdrant_sync_stats AS (', retrievalCte + 'qdrant_sync_stats AS (');
} else {
  // replace existing retrieval_stats CTE body if misplaced
  q = q.replace(/retrieval_stats AS \([\s\S]*?\),\s*qdrant_sync_stats AS \(/, retrievalCte + 'qdrant_sync_stats AS (');
  if (!q.includes(retrievalCte.trim().slice(0, 40))) {
    // if retrieval was at end without comma join to SELECT, remove orphan and inject before qdrant
    q = q.replace(/,\s*retrieval_stats AS \([\s\S]*?\)\s*\nSELECT/, '\nSELECT');
    if (!q.includes('retrieval_stats AS (')) {
      q = q.replace('qdrant_sync_stats AS (', retrievalCte + 'qdrant_sync_stats AS (');
    }
  }
}

if (!q.includes('retrieval_stats.retrieval_mode')) {
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

writeFileSync(new URL('./_health-repaired.sql', import.meta.url), q);

try {
  const r = await client.query(q);
  const row = r.rows[0] || {};
  console.log('SQL OK', {
    retrieval_mode: row.retrieval_mode,
    retrieval_version: row.retrieval_version,
    qdrant_synced: row.qdrant_synced,
    embedding_valid: row.embedding_valid,
    ai_eval_cases_count: row.ai_eval_cases_count,
    settings_count: row.settings_count,
  });
} catch (e) {
  console.error('SQL FAIL', e.message);
  process.exit(1);
}

const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const probe = nodes.find((n) => n.name === 'Probe database');
probe.parameters.query = q;

// Ensure prep maps retrieval fields
const prep = nodes.find((n) => n.parameters?.jsCode?.includes('dbItem'));
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
  if (prep.parameters.jsCode.includes('qdrantDb,') && !prep.parameters.jsCode.includes('retrievalDb,')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace('qdrantDb,', 'qdrantDb,\n      retrievalDb,');
  }
}

const agg = nodes.find((n) => n.name === 'Aggregate health');
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
console.log('health workflow updated', {
  prep: prep?.parameters?.jsCode?.includes('retrievalDb'),
  agg: agg?.parameters?.jsCode?.includes('retrieval:'),
});
await client.end();
