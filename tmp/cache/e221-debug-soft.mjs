#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const latest = await c.query(`
  SELECT question_hash, scope_hash, prompt_version_id, model_name, cache_key_hash, status, created_at
  FROM ai_semantic_cache_entries
  ORDER BY created_at DESC LIMIT 5`);
console.log(latest.rows);
const qh = latest.rows[0].question_hash;
const soft = await c.query(
  `SELECT id, left(cache_key_hash,12), status FROM ai_semantic_cache_entries
   WHERE status='VALID' AND question_hash=$1 AND scope_hash=$2
     AND prompt_version_id=$3 AND model_name=$4
   ORDER BY COALESCE(last_hit_at, created_at) DESC LIMIT 3`,
  [qh, latest.rows[0].scope_hash, latest.rows[0].prompt_version_id, latest.rows[0].model_name],
);
console.log('soft matches', soft.rows);

// Check runtime Lookup query text for syntax
const wf = await c.query(`SELECT nodes FROM workflow_entity WHERE id='c22CacheRuntime0001'`);
const nodes = typeof wf.rows[0].nodes === 'string' ? JSON.parse(wf.rows[0].nodes) : wf.rows[0].nodes;
const lookup = nodes.find((n) => n.name === 'Lookup exact');
console.log('lookup query snippet', String(lookup.parameters.query).slice(0, 500));
console.log('has SOFT', String(lookup.parameters.query).includes('SOFT'));
await c.end();
