#!/usr/bin/env node
/**
 * Fix Lookup UNION column count + force soft match without broken NONE row.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, connections, name FROM workflow_entity WHERE id='c22CacheRuntime0001'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const lookup = nodes.find((n) => n.name === 'Lookup exact');
lookup.alwaysOutputData = true;
lookup.onError = 'continueRegularOutput';
lookup.parameters.query = `={{ (() => {
  const op = String($('Build keys').first().json.operation || '');
  if (op !== 'lookup') return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash, 'NONE'::text AS lookup_mode WHERE true";
  const h = String($('Build keys').first().json.cacheKeyHash || '').replace(/'/g, "''");
  const qh = String($('Build keys').first().json.questionHash || '').replace(/'/g, "''");
  const sh = String($('Build keys').first().json.scopeHash || '').replace(/'/g, "''");
  const pv = String($('Build keys').first().json.promptVersionId || '').replace(/'/g, "''");
  const mn = String($('Build keys').first().json.modelName || 'gpt-4.1-mini').replace(/'/g, "''");
  if (!h) return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash, 'NONE'::text AS lookup_mode WHERE true";
  const pvClause = /^[0-9a-f-]{36}$/i.test(pv) ? ("prompt_version_id='" + pv + "'::uuid") : "true";
  return \`(
    SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id,
           model_name, source_fingerprint, source_fingerprint_version, answer, sources, status, expires_at, created_at,
           conflict_detected, insufficient_context, contains_sensitive_data, hit_count, document_version_ids, source_document_ids,
           'EXACT'::text AS lookup_mode
    FROM ai_semantic_cache_entries WHERE cache_key_hash='\${h}'
    LIMIT 1
  )
  UNION ALL
  (
    SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id,
           model_name, source_fingerprint, source_fingerprint_version, answer, sources, status, expires_at, created_at,
           conflict_detected, insufficient_context, contains_sensitive_data, hit_count, document_version_ids, source_document_ids,
           'SOFT'::text AS lookup_mode
    FROM ai_semantic_cache_entries
    WHERE status='VALID' AND question_hash='\${qh}' AND scope_hash='\${sh}'
      AND \${pvClause} AND model_name='\${mn}'
      AND cache_key_hash <> '\${h}'
    ORDER BY COALESCE(last_hit_at, created_at) DESC
    LIMIT 1
  )
  UNION ALL
  (
    SELECT NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::uuid, NULL::uuid,
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb, NULL::text, NULL::timestamptz, NULL::timestamptz,
           NULL::boolean, NULL::boolean, NULL::boolean, NULL::bigint, NULL::jsonb, NULL::jsonb,
           'NONE'::text
    WHERE NOT EXISTS (SELECT 1 FROM ai_semantic_cache_entries WHERE cache_key_hash='\${h}')
      AND NOT EXISTS (
        SELECT 1 FROM ai_semantic_cache_entries
        WHERE status='VALID' AND question_hash='\${qh}' AND scope_hash='\${sh}' AND \${pvClause} AND model_name='\${mn}'
      )
  )
  LIMIT 1\`;
})() }}`;

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,'c22CacheRuntime0001','etapa22.1',$2::json,$3::json,$4,'fix soft lookup SQL',false,NOW(),NOW())`,
  [versionId, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW() WHERE id='c22CacheRuntime0001'`,
  [JSON.stringify(nodes), versionId],
);
await client.query('COMMIT');
await client.query(`UPDATE workflow_entity SET active=false WHERE id='c22CacheRuntime0001'`);
await client.query(`UPDATE workflow_entity SET active=true WHERE id='c22CacheRuntime0001'`);
console.log('fixed lookup', versionId);
await client.end();
