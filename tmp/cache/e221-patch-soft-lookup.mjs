#!/usr/bin/env node
/**
 * Patch CACHE RUNTIME: normalize accents, nullish hashes, SHADOW secondary lookup by question_hash.
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

const prep = nodes.find((n) => n.name === 'Preparar entrada');
prep.parameters.jsCode = prep.parameters.jsCode.replace(
  "const normalizeQuestion=(raw)=>{let q=String(raw||'').normalize('NFKC').trim().toLowerCase();q=q.replace(/[?!.,;:]+$/g,'');q=q.replace(/[^\\p{L}\\p{N}\\s\\-./@]+/gu,' ');return q.replace(/\\s+/g,' ').trim();};",
  "const normalizeQuestion=(raw)=>{let q=String(raw||'').normalize('NFKD').replace(/\\p{M}+/gu,'').normalize('NFKC').trim().toLowerCase();q=q.replace(/[?!.,;:]+$/g,'');q=q.replace(/[^\\p{L}\\p{N}\\s\\-./@]+/gu,' ');return q.replace(/\\s+/g,' ').trim();};",
);

const build = nodes.find((n) => n.name === 'Build keys');
// normalize empty hashes to null in cache key
if (!build.parameters.jsCode.includes('normHash')) {
  build.parameters.jsCode = build.parameters.jsCode.replace(
    'const cacheKeyHash=sha256(canonical({',
    `const normHash=(v)=> { const s=v==null?'':String(v).trim(); return s?s:null; };
const cacheKeyHash=sha256(canonical({`,
  );
  build.parameters.jsCode = build.parameters.jsCode.replace(
    'promptContentHash:prep.promptHash,\n  retrievalConfigVersionId:prep.retrievalConfigVersionId,\n  retrievalConfigHash:prep.retrievalConfigHash,\n  contextConfigVersionId:prep.contextConfigVersionId,\n  contextConfigHash:prep.contextConfigHash,\n  modelName:prep.modelName,\n  modelParametersHash:prep.modelParametersHash,',
    'promptContentHash:normHash(prep.promptHash),\n  retrievalConfigVersionId:normHash(prep.retrievalConfigVersionId),\n  retrievalConfigHash:normHash(prep.retrievalConfigHash),\n  contextConfigVersionId:normHash(prep.contextConfigVersionId),\n  contextConfigHash:normHash(prep.contextConfigHash),\n  modelName:prep.modelName,\n  modelParametersHash:normHash(prep.modelParametersHash)||"",',
  );
}

const lookup = nodes.find((n) => n.name === 'Lookup exact');
lookup.parameters.query = `={{ (() => {
  const op = String($('Build keys').first().json.operation || '');
  if (op !== 'lookup') return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash, NULL::text AS lookup_mode WHERE true";
  const h = String($('Build keys').first().json.cacheKeyHash || '').replace(/'/g, "''");
  const qh = String($('Build keys').first().json.questionHash || '').replace(/'/g, "''");
  const sh = String($('Build keys').first().json.scopeHash || '').replace(/'/g, "''");
  const pv = String($('Build keys').first().json.promptVersionId || '').replace(/'/g, "''");
  const mn = String($('Build keys').first().json.modelName || '').replace(/'/g, "''");
  if (!h) return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash, NULL::text AS lookup_mode WHERE true";
  return \`WITH exact AS (
    SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id,
           model_name, source_fingerprint, source_fingerprint_version, answer, sources, status, expires_at, created_at,
           conflict_detected, insufficient_context, contains_sensitive_data, hit_count, document_version_ids, source_document_ids,
           'EXACT'::text AS lookup_mode
    FROM ai_semantic_cache_entries WHERE cache_key_hash='\${h}' LIMIT 1
  ), soft AS (
    SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id,
           model_name, source_fingerprint, source_fingerprint_version, answer, sources, status, expires_at, created_at,
           conflict_detected, insufficient_context, contains_sensitive_data, hit_count, document_version_ids, source_document_ids,
           'SOFT'::text AS lookup_mode
    FROM ai_semantic_cache_entries
    WHERE status='VALID' AND question_hash='\${qh}' AND scope_hash='\${sh}'
      AND prompt_version_id='\${pv}'::uuid AND model_name='\${mn}'
      AND NOT EXISTS (SELECT 1 FROM exact)
    ORDER BY COALESCE(last_hit_at, created_at) DESC
    LIMIT 1
  )
  SELECT * FROM exact
  UNION ALL
  SELECT * FROM soft
  UNION ALL
  SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE'
  WHERE NOT EXISTS (SELECT 1 FROM exact) AND NOT EXISTS (SELECT 1 FROM soft)
  LIMIT 1\`;
})() }}`;

const decide = nodes.find((n) => n.name === 'Decidir');
// Handle SOFT lookup: fingerprint mismatch => stale; match => treat as hit
if (!decide.parameters.jsCode.includes('lookup_mode')) {
  decide.parameters.jsCode = decide.parameters.jsCode.replace(
    "const found=!!(entry&&entry.id&&entry.cache_key_hash);",
    "const found=!!(entry&&entry.id&&entry.cache_key_hash);\n  const lookupMode=String(entry.lookup_mode||'EXACT');",
  );
  decide.parameters.jsCode = decide.parameters.jsCode.replace(
    "else if(configuration.requireSameSources!==false && String(entry.source_fingerprint)!==String(prep.sourceFingerprint)) {\n      missReason='SOURCE_FINGERPRINT_CHANGED';\n      invalidateEntryId=entry.id; invalidateReason='DOCUMENT_HASH_CHANGED';\n    }",
    `else if(configuration.requireSameSources!==false && String(entry.source_fingerprint)!==String(prep.sourceFingerprint)) {
      missReason='SOURCE_FINGERPRINT_CHANGED';
      if(lookupMode==='SOFT'){ /* stale candidate — do not invalidate eagerly on soft drift */ }
      else { invalidateEntryId=entry.id; invalidateReason='DOCUMENT_HASH_CHANGED'; }
    }`,
  );
  // After hit classification, if soft+same fp, still shadow candidate
  decide.parameters.jsCode = decide.parameters.jsCode.replace(
    "const shadowCandidateFound = mode==='SHADOW' && hit;",
    `const staleCandidate = mode==='SHADOW' && found && !hit && missReason==='SOURCE_FINGERPRINT_CHANGED' && lookupMode==='SOFT';
  const shadowCandidateFound = mode==='SHADOW' && hit;
  if(staleCandidate){ /* keep missReason */ }`,
  );
  decide.parameters.jsCode = decide.parameters.jsCode.replace(
    "invalidationPreventedHit:!!(invalidateEntryId&&!hit),",
    "invalidationPreventedHit:!!(invalidateEntryId&&!hit),\n    staleCandidate:!!staleCandidate,",
  );
}

// Block negative answers on save
if (!decide.parameters.jsCode.includes('NEGATIVE_ANSWER')) {
  decide.parameters.jsCode = decide.parameters.jsCode.replace(
    "if(prepared.nearestSourceExpiration && new Date(prepared.nearestSourceExpiration).getTime()<=Date.now()) reasonCodes.push('DOCUMENT_EXPIRED');",
    `if(prepared.nearestSourceExpiration && new Date(prepared.nearestSourceExpiration).getTime()<=Date.now()) reasonCodes.push('DOCUMENT_EXPIRED');
  if(/n[aã]o (encontrei|localizei|há informa)|sem resultados|protocolo alien/i.test(answer) && configuration.cacheNegativeAnswers!==true) reasonCodes.push('NEGATIVE_ANSWER');`,
  );
}

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,'c22CacheRuntime0001','etapa22.1',$2::json,$3::json,$4,'soft lookup + normalize',false,NOW(),NOW())`,
  [versionId, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id='c22CacheRuntime0001'`,
  [JSON.stringify(nodes), JSON.stringify(connections), versionId],
);
await client.query('COMMIT');

// helpers accent normalize
await client.end();
console.log('patched runtime', versionId);
