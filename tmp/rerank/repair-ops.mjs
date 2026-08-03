#!/usr/bin/env node
/** Repair health probe SQL and dataset INSERT after bad patch */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Restore health probe from workflow_history previous if needed — better rebuild from qdrant patched version in tmp
// Load current broken probe and also try GET from history versions

const { rows: hist } = await client.query(
  `SELECT "versionId", nodes, "updatedAt"
   FROM workflow_history
   WHERE "workflowId"='qAyYc9DrHIqe4L9i'
   ORDER BY "updatedAt" DESC
   LIMIT 5`,
);

let restored = null;
for (const h of hist) {
  const nodes = typeof h.nodes === 'string' ? JSON.parse(h.nodes) : h.nodes;
  const probe = nodes.find((n) => n.name === 'Probe database');
  const q = probe?.parameters?.query || '';
  if (q.includes('qdrant_sync_stats') && !q.includes('retrieval_stats.retrieval_mode AS retrieval_mode,\n  retrieval_stats')) {
    // still might be broken if this is current. Check for mangled FROM settings
    if (!q.includes('FROM settings) AS settings_count')) {
      restored = { versionId: h.versionId, query: q, nodes };
      break;
    }
  }
  if (q.includes('FROM settings) AS settings_count')) continue;
  if (q.includes('settings_count') && q.includes('qdrant_sync_stats') && !q.includes('retrieval_stats AS')) {
    restored = { versionId: h.versionId, query: q, nodes };
    break;
  }
}

// If no good history, try reading from tmp embeddings/qdrant probe files
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const dir = dirname(fileURLToPath(import.meta.url));

let baseQuery = restored?.query || null;
if (!baseQuery) {
  // pull from entity before our broken patch via checking if any history is good
  for (const h of hist) {
    const nodes = typeof h.nodes === 'string' ? JSON.parse(h.nodes) : h.nodes;
    const probe = nodes.find((n) => n.name === 'Probe database');
    const q = probe?.parameters?.query || '';
    if (q.includes('(SELECT COUNT(*)::int   retrieval_stats')) continue;
    if (q.includes('settings_count') && q.includes('CROSS JOIN')) {
      baseQuery = q;
      restored = { versionId: h.versionId, query: q, nodes };
      break;
    }
  }
}

if (!baseQuery) {
  // Last resort: use remote file from ai-prompts health probe and re-apply qdrant+retrieval
  const candidates = [
    join(dir, '../embeddings/_probe-database.sql'),
    join(dir, '../ai-prompts/_health-Probe_database.sql'),
    join(dir, '../qdrant/_health-probe.sql'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      baseQuery = readFileSync(p, 'utf8');
      console.log('using file', p);
      break;
    }
  }
}

if (!baseQuery) throw new Error('Could not find healthy probe SQL baseline');

writeFileSync(new URL('./_health-base.sql', import.meta.url), baseQuery);
console.log('base length', baseQuery.length, 'has qdrant', baseQuery.includes('qdrant'), 'has mangled', baseQuery.includes('FROM settings) AS settings_count'));

// Ensure retrieval_stats CTE exists cleanly
let q = baseQuery;
// Remove any previous broken retrieval injections
q = q.replace(/,\s*retrieval_stats AS \([\s\S]*?\)\s*(?=,?\s*(?:ai_eval_stats|qdrant_sync_stats|embedding_stats|SELECT))/g, '');
q = q.replace(/retrieval_stats\.[^\n]+\n/g, '');
q = q.replace(/\nCROSS JOIN retrieval_stats/g, '');

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
)`;

if (q.includes('qdrant_sync_stats AS')) {
  q = q.replace('qdrant_sync_stats AS (', `${retrievalCte},\nqdrant_sync_stats AS (`);
} else if (q.includes('ai_eval_stats AS')) {
  q = q.replace('ai_eval_stats AS (', `${retrievalCte},\nai_eval_stats AS (`);
} else {
  // insert before final SELECT
  const idx = q.lastIndexOf('\nSELECT\n');
  if (idx > 0) q = q.slice(0, idx) + `,\n${retrievalCte}` + q.slice(idx);
}

// Add select columns near other stats — find a stable anchor
if (!q.includes('retrieval_stats.retrieval_mode')) {
  if (q.includes('qdrant_sync_stats.qdrant_last_sync,')) {
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
  } else if (q.includes('ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms')) {
    q = q.replace(
      'ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms',
      `ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms,
  retrieval_stats.retrieval_mode,
  retrieval_stats.retrieval_version,
  retrieval_stats.retrieval_drafts,
  retrieval_stats.retrieval_published,
  retrieval_stats.retrieval_avg_rerank_ms,
  retrieval_stats.retrieval_fallback_count,
  retrieval_stats.retrieval_avg_candidates,
  retrieval_stats.retrieval_avg_final,
  retrieval_stats.retrieval_last_validation`,
    );
  }
}

if (!q.includes('CROSS JOIN retrieval_stats')) {
  if (q.includes('CROSS JOIN qdrant_sync_stats')) {
    q = q.replace('CROSS JOIN qdrant_sync_stats', 'CROSS JOIN qdrant_sync_stats\nCROSS JOIN retrieval_stats');
  } else if (q.includes('CROSS JOIN ai_eval_stats')) {
    q = q.replace('CROSS JOIN ai_eval_stats', 'CROSS JOIN ai_eval_stats\nCROSS JOIN retrieval_stats');
  } else if (q.includes('CROSS JOIN embedding_stats')) {
    q = q.replace('CROSS JOIN embedding_stats', 'CROSS JOIN embedding_stats\nCROSS JOIN retrieval_stats');
  }
}

// Validate by running query remotely
const test = await client.query(`EXPLAIN ${q.replace(/;$/, '')}`);
console.log('EXPLAIN ok rows', test.rowCount);

const { rows: ent } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof ent[0].nodes === 'string' ? JSON.parse(ent[0].nodes) : ent[0].nodes;
const probe = nodes.find((n) => n.name === 'Probe database');
probe.parameters.query = q;

// Ensure prep/agg still have retrievalDb from previous patch
const prep = nodes.find((n) => n.parameters?.jsCode?.includes('retrievalDb') || n.parameters?.jsCode?.includes('embeddingsDb'));
const agg = nodes.find((n) => n.name === 'Aggregate health');
console.log('prep has retrievalDb', !!prep?.parameters?.jsCode?.includes('retrievalDb'));
console.log('agg has retrieval', !!agg?.parameters?.jsCode?.includes('retrieval:'));

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='qAyYc9DrHIqe4L9i'`,
  [JSON.stringify(nodes)],
);
if (ent[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$2`,
    [JSON.stringify(nodes), ent[0].activeVersionId],
  );
}

// Fix dataset INSERT
const { rows: dsr } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`,
);
const dsn = typeof dsr[0].nodes === 'string' ? JSON.parse(dsr[0].nodes) : dsr[0].nodes;
const insert = dsn.find((n) => String(n.parameters?.query || '').includes('INSERT INTO ai_test_runs'));
if (insert) {
  let iq = insert.parameters.query;
  // Fix column/value mismatch
  if (iq.includes('retrieval_mode, retrieval_config_version)') && iq.includes(",\n  'hybrid'\nFROM")) {
    iq = iq.replace(
      ",\n  'hybrid'\nFROM",
      `,\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), 'HYBRID'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1), 'hybrid-v1')\nFROM`,
    );
  } else if (iq.includes("retrieval_config_version)\nSELECT") && !iq.includes("key='retrieval_active_version'")) {
    iq = iq.replace(
      /,\s*'hybrid'\s*\nFROM/i,
      `,\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), 'HYBRID'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1), 'hybrid-v1')\nFROM`,
    );
  }
  insert.parameters.query = iq;
  writeFileSync(new URL('./_dataset-insert-fixed.sql', import.meta.url), iq);
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='12t0Ol6zWQJgAKPC'`,
    [JSON.stringify(dsn)],
  );
  if (dsr[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='12t0Ol6zWQJgAKPC' AND "versionId"=$2`,
      [JSON.stringify(dsn), dsr[0].activeVersionId],
    );
  }
  console.log('dataset fixed', iq.includes("key='retrieval_active_version'"));
}

writeFileSync(new URL('./_health-probe-fixed.sql', import.meta.url), q);
console.log('health repaired');
await client.end();
