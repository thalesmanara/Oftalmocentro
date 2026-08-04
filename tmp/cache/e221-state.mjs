#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const e = await c.query(
  `SELECT id, source_document_ids, document_version_ids, source_fingerprint,
          shadow_candidate_count, served_hit_count, source_fingerprint_version,
          ttl_policy, effective_ttl_seconds, nearest_source_expiration, not_cacheable_reason, metadata
     FROM ai_semantic_cache_entries LIMIT 1`,
);
console.log('entry', JSON.stringify(e.rows[0], null, 2));
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name='ai_semantic_cache_entries'
      AND (column_name LIKE '%shadow%' OR column_name LIKE '%ttl%'
           OR column_name LIKE '%fingerprint%' OR column_name LIKE '%not_cache%'
           OR column_name LIKE '%effective%' OR column_name LIKE '%nearest%')
    ORDER BY 1`,
);
console.log('new cols', cols.rows.map((r) => r.column_name));
const wf = await c.query(
  `SELECT id, name, active FROM workflow_entity
    WHERE name ILIKE '%CACHE%' OR name ILIKE '%INVALIDAR%'
       OR name ILIKE '%PROMPT%PUBLISH%' OR name ILIKE '%PROMPT%ROLLBACK%'
       OR name ILIKE '%RETRIEVAL%PUBLISH%' OR name ILIKE '%RETRIEVAL%ROLLBACK%'
       OR name ILIKE '%CONTEXT%PUBLISH%' OR name ILIKE '%CONTEXT%ROLLBACK%'
       OR name ILIKE '%Publicar%prompt%' OR name ILIKE '%Publicar%retrieval%'
       OR name ILIKE '%Publicar%contexto%' OR name ILIKE '%Rollback%'
    ORDER BY name`,
);
for (const r of wf.rows) console.log(r.active ? 'A' : '-', r.id, r.name);
const nodes = await c.query(
  `SELECT jsonb_array_elements(nodes::jsonb)->>'name' AS n,
          jsonb_array_elements(nodes::jsonb)->>'type' AS t
     FROM workflow_entity WHERE id='c22CacheRuntime0001'`,
);
console.log('runtime nodes', nodes.rows);
const lookup = await c.query(
  `SELECT n->>'name' AS name, n->'parameters'->>'alwaysOutputData' AS aod,
          (n->'onError')::text AS onerr
     FROM workflow_entity w,
          LATERAL jsonb_array_elements(w.nodes::jsonb) n
    WHERE w.id='c22CacheRuntime0001' AND n->>'name'='Lookup exact'`,
);
console.log('lookup node', lookup.rows);
await c.end();
