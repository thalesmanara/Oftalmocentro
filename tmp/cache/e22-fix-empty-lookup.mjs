#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const RUNTIME = 'c22CacheRuntime0001';
const CONSULTA = '8EXk5RkFW5cxnenL';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

const runtimeVid = await bump(RUNTIME, 'alwaysOutputData on Lookup/Persist empty results', (nodes) => {
  for (const name of ['Lookup exact', 'Load config', 'Persistir se necessário']) {
    const n = nodes.find((x) => x.name === name);
    if (!n) continue;
    n.alwaysOutputData = true;
    n.onError = 'continueRegularOutput';
    n.parameters = n.parameters || {};
    n.parameters.options = { ...(n.parameters.options || {}), queryBatching: 'single' };
  }
  // Also harden Lookup SQL to always return a row
  const lookup = nodes.find((n) => n.name === 'Lookup exact');
  lookup.parameters.query = `={{ (() => {
  const op = String($('Preparar entrada').first().json.operation || '');
  if (op !== 'lookup') return "SELECT NULL::uuid AS id, NULL::varchar AS cache_key_hash";
  const h = String($('Preparar entrada').first().json.cacheKeyHash || '').replace(/'/g, "''");
  if (!h) return "SELECT NULL::uuid AS id, NULL::varchar AS cache_key_hash";
  return "SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id, model_name, source_fingerprint, answer, sources, status, expires_at, created_at, conflict_detected, insufficient_context, contains_sensitive_data, hit_count FROM ai_semantic_cache_entries WHERE cache_key_hash='" + h + "' UNION ALL SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL WHERE NOT EXISTS (SELECT 1 FROM ai_semantic_cache_entries WHERE cache_key_hash='" + h + "') LIMIT 1";
})() }}`;
});

// Ensure Consulta executeWorkflow continues on empty/error
const consultaVid = await bump(CONSULTA, 'Cache lookup continue on fail + alwaysOutputData', (nodes) => {
  for (const name of ['IA - CONSULTAR CACHE', 'IA - SALVAR CACHE']) {
    const n = nodes.find((x) => x.name === name);
    if (!n) continue;
    n.alwaysOutputData = true;
    n.onError = 'continueRegularOutput';
  }
  // Harden Aplicar cache lookup when subworkflow empty
  const aplicar = nodes.find((n) => n.name === 'Aplicar cache lookup');
  aplicar.parameters.jsCode = `const ctx=$('Aplicar janela de contexto').first().json||{};
const cache=$input.first().json||{};
const cacheMeta=cache.cacheMeta||{
  mode:'SHADOW', configVersion:'cache-shadow-v1', lookupPerformed:false, hit:false,
  missReason: cache.errorCode || 'CACHE_DISABLED', answerFromCache:false, fallbackUsed:true,
  fallbackReason:'CACHE_LOOKUP_EMPTY', requestId:($('Normalizar request').first().json||{}).requestId||''
};
return [{json:{...ctx, cacheMeta, serveFromCache:!!cache.serveFromCache, cachedAnswer:cache.cachedAnswer||null, cachedSources:cache.cachedSources||null, cachePrepared:cache.prepared||null, cacheCandidateAnswer:cache.candidateAnswer||null, cacheCandidateSources:cache.candidateSources||null}}];`;
});

await client.end();
console.log(JSON.stringify({ runtimeVid, consultaVid }));
