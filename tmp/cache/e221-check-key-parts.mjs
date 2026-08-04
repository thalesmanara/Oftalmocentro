#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const e = await c.query(`
  SELECT left(normalized_question,50) AS q,
         left(cache_key_hash,16) AS key,
         left(question_hash,12) AS qh,
         left(scope_hash,12) AS sc,
         left(classification_hash,12) AS ch,
         left(prompt_hash,12) AS ph,
         left(COALESCE(retrieval_config_hash,''),12) AS rh,
         left(COALESCE(context_config_hash,''),12) AS cxh,
         model_name,
         left(source_fingerprint,12) AS fp,
         prompt_version_id, retrieval_config_version_id, context_config_version_id
  FROM ai_semantic_cache_entries
  WHERE normalized_question ILIKE '%funcion%'
  ORDER BY created_at`);
console.log(JSON.stringify(e.rows, null, 2));
await c.end();
