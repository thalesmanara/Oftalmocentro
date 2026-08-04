#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const e = await c.query(`
  SELECT left(normalized_question,60) AS q, left(cache_key_hash,12) AS key,
         left(source_fingerprint,12) AS fp, status, source_fingerprint_version,
         jsonb_array_length(document_version_ids) AS nver,
         jsonb_array_length(source_document_ids) AS ndoc,
         effective_ttl_seconds, ttl_policy,
         (SELECT COUNT(*) FROM ai_semantic_cache_dependencies d WHERE d.cache_entry_id=e.id) AS deps
  FROM ai_semantic_cache_entries e
  WHERE status='VALID'
  ORDER BY created_at DESC`);
console.log(e.rows);
const dup = await c.query(`
  SELECT question_hash, COUNT(*) AS n, COUNT(DISTINCT source_fingerprint) AS fps
  FROM ai_semantic_cache_entries
  GROUP BY question_hash HAVING COUNT(*)>1`);
console.log('dup questions', dup.rows);
await c.end();
