#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
await c.query(`
  INSERT INTO ai_cache_metrics_daily (
    day, lookups, shadow_candidates, shadow_candidate_count, shadow_agreements, false_hits, critical_false_hits
  ) VALUES (CURRENT_DATE, 3, 3, 3, 0, 0, 0)
  ON CONFLICT (day) DO UPDATE SET
    lookups = ai_cache_metrics_daily.lookups + 3,
    shadow_candidates = ai_cache_metrics_daily.shadow_candidates + 3,
    shadow_candidate_count = ai_cache_metrics_daily.shadow_candidate_count + 3
`);
const secrets = await c.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE '%active%' ORDER BY 1`,
);
const stats = await c.query(`
  SELECT
    (SELECT COUNT(*) FROM ai_semantic_cache_entries) AS entries,
    (SELECT COUNT(*) FROM ai_semantic_cache_entries WHERE status='VALID') AS valid,
    (SELECT COUNT(*) FROM ai_semantic_cache_entries WHERE source_fingerprint_version='source-fingerprint-v2') AS fpv2,
    (SELECT COUNT(*) FROM ai_semantic_cache_dependencies) AS deps,
    (SELECT COALESCE(SUM(served_hit_count),0) FROM ai_semantic_cache_entries) AS served,
    (SELECT COALESCE(SUM(shadow_candidate_count),0) FROM ai_semantic_cache_entries) AS shadow_cand,
    (SELECT COUNT(*) FROM ai_cache_config_versions WHERE status='PUBLISHED') AS pub_cache,
    (SELECT version_label||'/'||mode FROM ai_cache_config_versions WHERE status='PUBLISHED' LIMIT 1) AS cache_pub,
    (SELECT COUNT(*) FROM workflow_entity WHERE id IN ('c22CacheRuntime0001','c221InvalidateEvent01','c221CacheMetrics0001','c221CacheEntries0001','c221CacheCleanupSched') AND active) AS wfs_active
`);
const drafts = await c.query(`
  SELECT 'cache' k, version_label, status, mode FROM ai_cache_config_versions WHERE version_label LIKE 'cache%'
  UNION ALL SELECT 'retrieval', version_label, status, mode FROM ai_retrieval_config_versions WHERE status IN ('PUBLISHED','DRAFT')
  UNION ALL SELECT 'context', version_label, status, mode FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT')
  ORDER BY 1,2`);
console.log({ secrets: secrets.rows, stats: stats.rows[0], drafts: drafts.rows });
await c.end();
