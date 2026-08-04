#!/usr/bin/env node
/**
 * Etapa 22.1 — metrics/entries/shadow-validation admin endpoints + health enrich.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const client = new pg.Client({ connectionString: PG });
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true }) {
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  const exists = await client.query(`SELECT id FROM workflow_entity WHERE id=$1`, [id]);
  await client.query('BEGIN');
  if (!exists.rowCount) {
    await client.query(
      `INSERT INTO workflow_entity (id,name,active,nodes,connections,"versionId","activeVersionId","createdAt","updatedAt",settings,"isArchived")
       VALUES ($1,$2,false,$3::json,$4::json,$5::varchar,NULL,NOW(),NOW(),'{}'::json,false)`,
      [id, name, nodesJson, connJson, versionId],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
         VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
  }
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,'Etapa 22.1',false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  return versionId;
}

async function registerWebhook(wfId, method, path) {
  const wid = randomUUID().replace(/-/g, '').slice(0, 16);
  await client.query(
    `INSERT INTO webhook_entity ("webhookPath", method, node, "webhookId", "pathLength", "workflowId")
     SELECT $1::text, $2::text, 'Webhook', $3::varchar, array_length(string_to_array($1::text,'/'),1), $4::varchar
     WHERE NOT EXISTS (
       SELECT 1 FROM webhook_entity WHERE "workflowId"=$4::varchar AND "webhookPath"=$1::text AND method=$2::text
     )`,
    [path, method, wid, wfId],
  );
}

function authNodes(path, method, sqlBuilderCode, resultAssemblerCode) {
  // Reuse pattern from etapa22 admin: Webhook → Validar auth → IF → SQL → Montar → Respond
  // Keep compact: Webhook → Code auth check via execute existing auth subworkflow if available
  // Simpler: call same Validar JWT pattern used elsewhere
  return [
    {
      id: randomUUID(),
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: randomUUID(),
      parameters: {
        httpMethod: method,
        path,
        responseMode: 'responseNode',
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Validar auth',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [220, 0],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: 'AuthValidateJwt0001' },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            authorization: "={{ $json.headers?.authorization || $json.headers?.Authorization || '' }}",
            requiredPermission: "={{ 'editar_configuracoes' }}",
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Auth ok?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [440, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.ok === true || $json.authorized === true || $json.valid === true }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
        ],
          combinator: 'and',
        },
      },
    },
    {
      id: randomUUID(),
      name: 'Montar SQL',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, -80],
      parameters: { jsCode: sqlBuilderCode },
    },
    {
      id: randomUUID(),
      name: 'Query',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [880, -80],
      credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
      parameters: {
        operation: 'executeQuery',
        query: '={{ $json.sql }}',
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Montar resposta',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, -80],
      parameters: { jsCode: resultAssemblerCode },
    },
    {
      id: randomUUID(),
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1320, -80],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: { responseCode: "={{ $json.statusCode || 200 }}" },
      },
    },
    {
      id: randomUUID(),
      name: 'Respond 403',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [660, 120],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ { success:false, statusCode:403, message:"Forbidden" } }}',
        options: { responseCode: 403 },
      },
    },
  ];
}

const metricsSql = `const q=$('Webhook').first().json.query||{};
const days=Math.min(30, Math.max(1, Number(q.days||7)||7));
const sql=\`SELECT jsonb_build_object(
  'activeMode', (SELECT value FROM app_secrets WHERE key='cache_active_mode' LIMIT 1),
  'activeVersion', (SELECT value FROM app_secrets WHERE key='cache_active_version' LIMIT 1),
  'entries', (SELECT jsonb_build_object(
     'total', COUNT(*),
     'valid', COUNT(*) FILTER (WHERE status='VALID'),
     'expired', COUNT(*) FILTER (WHERE status='EXPIRED'),
     'invalidated', COUNT(*) FILTER (WHERE status='INVALIDATED'),
     'fpV2', COUNT(*) FILTER (WHERE source_fingerprint_version='source-fingerprint-v2'),
     'shadowCandidateSum', COALESCE(SUM(shadow_candidate_count),0),
     'servedHitSum', COALESCE(SUM(served_hit_count),0)
   ) FROM ai_semantic_cache_entries),
  'dependencies', (SELECT jsonb_build_object(
     'total', COUNT(*),
     'entriesCovered', COUNT(DISTINCT cache_entry_id)
   ) FROM ai_semantic_cache_dependencies),
  'dependencyCoverageRate', (
     SELECT CASE WHEN v.valid=0 THEN 1.0 ELSE v.covered::float/v.valid END
     FROM (
       SELECT
         (SELECT COUNT(*) FROM ai_semantic_cache_entries WHERE status='VALID') AS valid,
         (SELECT COUNT(DISTINCT e.id) FROM ai_semantic_cache_entries e
            JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id=e.id
           WHERE e.status='VALID') AS covered
     ) v
  ),
  'daily', COALESCE((
     SELECT jsonb_agg(to_jsonb(m) ORDER BY m.day DESC)
     FROM (
       SELECT day, lookups, hits, misses, shadow_candidates, shadow_candidate_count, shadow_agreements,
              false_hits, critical_false_hits, stale_candidates, invalidation_prevented_hits,
              expiration_prevented_hits, scope_mismatch_prevented, sensitive_blocked,
              conflict_blocked, insufficient_blocked, fallback_blocked, cacheable, non_cacheable,
              invalidations, evictions, estimated_tokens_saved, estimated_latency_saved_ms
       FROM ai_cache_metrics_daily
       WHERE day >= CURRENT_DATE - \${days}
       ORDER BY day DESC
     ) m
  ), '[]'::jsonb)
) AS data\`;
return [{json:{sql}}];`;

const metricsOut = `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
return [{json:{success:true,statusCode:200,data}}];`;

const entriesSql = `const q=$('Webhook').first().json.query||{};
const status=String(q.status||'').replace(/[^A-Z_]/g,'').slice(0,20);
const reason=String(q.invalidationReason||q.reason||'').replace(/'/g,"''").slice(0,80);
const scope=String(q.scopeHashPrefix||'').replace(/[^a-f0-9]/gi,'').slice(0,16);
const limit=Math.min(100, Math.max(1, Number(q.limit||50)||50));
const where=[];
if(status) where.push("status='"+status+"'");
if(reason) where.push("invalidation_reason='"+reason+"'");
if(scope) where.push("scope_hash LIKE '"+scope+"%'");
const w=where.length?('WHERE '+where.join(' AND ')):'';
const sql=\`SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) AS data FROM (
  SELECT id, status, left(scope_hash,12) AS scope_hash_abbrev, source_fingerprint_version,
         invalidation_reason, miss_reason_last, ttl_policy, effective_ttl_seconds,
         shadow_candidate_count, served_hit_count, hit_count, created_at, expires_at,
         invalidated_at, last_hit_at, cache_config_version_id
  FROM ai_semantic_cache_entries
  \${w}
  ORDER BY created_at DESC
  LIMIT \${limit}
) x\`;
return [{json:{sql}}];`;

// miss_reason_last may not exist - fix entries query
const entriesSqlSafe = `const q=$('Webhook').first().json.query||{};
const status=String(q.status||'').replace(/[^A-Z_]/g,'').slice(0,20);
const reason=String(q.invalidationReason||q.reason||'').replace(/'/g,"''").slice(0,80);
const scope=String(q.scopeHashPrefix||'').replace(/[^a-f0-9]/gi,'').slice(0,16);
const limit=Math.min(100, Math.max(1, Number(q.limit||50)||50));
const where=[];
if(status) where.push("status='"+status+"'");
if(reason) where.push("invalidation_reason='"+reason+"'");
if(scope) where.push("scope_hash LIKE '"+scope+"%'");
const w=where.length?('WHERE '+where.join(' AND ')):'';
const sql=\`SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) AS data FROM (
  SELECT id, status, left(scope_hash,12) AS "scopeHashAbbrev", source_fingerprint_version AS "sourceFingerprintVersion",
         invalidation_reason AS "invalidationReason", ttl_policy AS "ttlPolicy",
         effective_ttl_seconds AS "effectiveTtlSeconds",
         shadow_candidate_count AS "shadowCandidateCount", served_hit_count AS "servedHitCount",
         hit_count AS "hitCount", created_at AS "createdAt", expires_at AS "expiresAt",
         invalidated_at AS "invalidatedAt", last_hit_at AS "lastHitAt"
  FROM ai_semantic_cache_entries
  \${w}
  ORDER BY created_at DESC
  LIMIT \${limit}
) x\`;
return [{json:{sql}}];`;

const entriesOut = `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data=[];}}
if(!Array.isArray(data) && data) data=[data];
return [{json:{success:true,statusCode:200,data:{items:data||[]}}}];`;

const shadowSql = `return [{json:{sql: \`SELECT jsonb_build_object(
  'ok', true,
  'message', 'Use o script e221-shadow-volume / laboratório para rodadas controladas',
  'activeMode', (SELECT value FROM app_secrets WHERE key='cache_active_mode' LIMIT 1),
  'metricsToday', (SELECT to_jsonb(m) FROM ai_cache_metrics_daily m WHERE day=CURRENT_DATE)
) AS data\`}}];`;

const shadowOut = metricsOut;

function conns() {
  return {
    Webhook: { main: [[{ node: 'Validar auth', type: 'main', index: 0 }]] },
    'Validar auth': { main: [[{ node: 'Auth ok?', type: 'main', index: 0 }]] },
    'Auth ok?': {
      main: [
        [{ node: 'Montar SQL', type: 'main', index: 0 }],
        [{ node: 'Respond 403', type: 'main', index: 0 }],
      ],
    },
    'Montar SQL': { main: [[{ node: 'Query', type: 'main', index: 0 }]] },
    Query: { main: [[{ node: 'Montar resposta', type: 'main', index: 0 }]] },
    'Montar resposta': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
  };
}

// Find real auth workflow id
const authWf = await client.query(
  `SELECT id, name FROM workflow_entity WHERE name ILIKE '%validar%auth%' OR name ILIKE '%auth%jwt%' OR id LIKE 'Auth%' ORDER BY active DESC, name LIMIT 20`,
);
console.log('auth candidates', authWf.rows);

// Use same auth as other cache admins
const listWf = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='c22CacheList0000001'`,
);
const listNodes =
  typeof listWf.rows[0].nodes === 'string' ? JSON.parse(listWf.rows[0].nodes) : listWf.rows[0].nodes;
const authNode = listNodes.find((n) => /auth|validar/i.test(n.name));
console.log(
  'list auth node',
  authNode?.name,
  authNode?.parameters?.workflowId?.value || authNode?.parameters?.workflowId,
);

const AUTH_ID =
  authNode?.parameters?.workflowId?.value ||
  (typeof authNode?.parameters?.workflowId === 'string' ? authNode.parameters.workflowId : null) ||
  'P5E43ZXSJiI9wFYD';

function patchAuth(nodes) {
  const n = nodes.find((x) => x.name === 'Validar auth');
  if (n) n.parameters.workflowId = { __rl: true, mode: 'id', value: AUTH_ID };
  // copy input mapping from list if present
  if (authNode?.parameters?.workflowInputs) {
    n.parameters.workflowInputs = authNode.parameters.workflowInputs;
  }
}

const metricsNodes = authNodes('system/ai-cache/metrics', 'GET', metricsSql, metricsOut);
patchAuth(metricsNodes);
const metricsVid = await upsertWorkflow({
  id: 'c221CacheMetrics0001',
  name: 'SYSTEM - AI CACHE METRICS',
  nodes: metricsNodes,
  connections: conns(),
  active: true,
});
await registerWebhook('c221CacheMetrics0001', 'GET', 'system/ai-cache/metrics');

const entriesNodes = authNodes('system/ai-cache/entries', 'GET', entriesSqlSafe, entriesOut);
patchAuth(entriesNodes);
const entriesVid = await upsertWorkflow({
  id: 'c221CacheEntries0001',
  name: 'SYSTEM - AI CACHE ENTRIES',
  nodes: entriesNodes,
  connections: conns(),
  active: true,
});
await registerWebhook('c221CacheEntries0001', 'GET', 'system/ai-cache/entries');

const shadowNodes = authNodes('system/ai-cache/run-shadow-validation', 'POST', shadowSql, shadowOut);
patchAuth(shadowNodes);
const shadowVid = await upsertWorkflow({
  id: 'c221CacheShadowRun01',
  name: 'SYSTEM - AI CACHE RUN SHADOW VALIDATION',
  nodes: shadowNodes,
  connections: conns(),
  active: true,
});
await registerWebhook('c221CacheShadowRun01', 'POST', 'system/ai-cache/run-shadow-validation');

writeFileSync(
  new URL('./_e221-admin-endpoints.json', import.meta.url),
  JSON.stringify({ metricsVid, entriesVid, shadowVid, AUTH_ID }, null, 2),
);

// Enrich health cache_stats with shadow metrics
const health = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const hNodes = typeof health.rows[0].nodes === 'string' ? JSON.parse(health.rows[0].nodes) : health.rows[0].nodes;
const probe = hNodes.find((n) => n.name === 'Probe database');
if (probe && !probe.parameters.query.includes('cache_shadow_candidate')) {
  probe.parameters.query = probe.parameters.query.replace(
    'cache_stats.cache_false_hits_7d,',
    `cache_stats.cache_false_hits_7d,
  cache_stats.cache_shadow_candidate_7d,
  cache_stats.cache_shadow_agree_7d,
  cache_stats.cache_critical_false_7d,
  cache_stats.cache_stale_7d,
  cache_stats.cache_inv_prev_7d,
  cache_stats.cache_dep_coverage,`,
  );
  probe.parameters.query = probe.parameters.query.replace(
    `(SELECT COALESCE(SUM(false_hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_false_hits_7d,`,
    `(SELECT COALESCE(SUM(false_hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_false_hits_7d,
    (SELECT COALESCE(SUM(COALESCE(shadow_candidate_count, shadow_candidates,0)),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_shadow_candidate_7d,
    (SELECT COALESCE(SUM(shadow_agreements),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_shadow_agree_7d,
    (SELECT COALESCE(SUM(critical_false_hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_critical_false_7d,
    (SELECT COALESCE(SUM(stale_candidates),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_stale_7d,
    (SELECT COALESCE(SUM(invalidation_prevented_hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_inv_prev_7d,
    (
      SELECT CASE WHEN v.valid=0 THEN 1.0 ELSE ROUND(v.covered::numeric/v.valid,4) END
      FROM (
        SELECT
          (SELECT COUNT(*) FROM ai_semantic_cache_entries WHERE status='VALID') AS valid,
          (SELECT COUNT(DISTINCT e.id) FROM ai_semantic_cache_entries e
             JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id=e.id
            WHERE e.status='VALID') AS covered
      ) v
    ) AS cache_dep_coverage,`,
  );
}
const prep = hNodes.find((n) => n.name === 'Prepare checks');
if (prep && !prep.parameters.jsCode.includes('shadowCandidate7d')) {
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    'falseHits7d: Number(dbItem.cache_false_hits_7d ?? 0) || 0,',
    `falseHits7d: Number(dbItem.cache_false_hits_7d ?? 0) || 0,
      shadowCandidate7d: Number(dbItem.cache_shadow_candidate_7d ?? 0) || 0,
      shadowAgree7d: Number(dbItem.cache_shadow_agree_7d ?? 0) || 0,
      criticalFalse7d: Number(dbItem.cache_critical_false_7d ?? 0) || 0,
      stale7d: Number(dbItem.cache_stale_7d ?? 0) || 0,
      invPrev7d: Number(dbItem.cache_inv_prev_7d ?? 0) || 0,
      depCoverage: Number(dbItem.cache_dep_coverage ?? 1) || 0,`,
  );
}
const agg = hNodes.find((n) => n.name === 'Aggregate health');
if (agg && agg.parameters.jsCode.includes('semanticCache:') && !agg.parameters.jsCode.includes('shadowCandidateRate7d')) {
  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    'falseHitCount7d: falseHits,',
    `falseHitCount7d: falseHits,
      criticalFalseHitCount7d: Number(c.criticalFalse7d || 0),
      staleCandidateCount7d: Number(c.stale7d || 0),
      invalidationPreventedHitCount7d: Number(c.invPrev7d || 0),
      shadowCandidateRate7d: lookups > 0 ? Number(c.shadowCandidate7d || 0) / lookups : 0,
      shadowAgreementRate7d: Number(c.shadowCandidate7d || 0) > 0 ? Number(c.shadowAgree7d || 0) / Number(c.shadowCandidate7d || 1) : null,
      dependencyCoverageRate: Number(c.depCoverage || 0),`,
  );
  // degrade on critical false / incomplete deps
  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    "if (published > 1 || !secretsMatch || falseHits > 0) status = 'degraded';",
    "if (published > 1 || !secretsMatch || falseHits > 0 || Number(c.criticalFalse7d||0)>0 || (Number(c.depCoverage||1)<1 && Number(c.validCount||0)>0)) status = 'degraded';",
  );
}

const hVid = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   SELECT $1::varchar, id, 'etapa22.1', $2::json, connections, name, 'shadow health metrics', false, NOW(), NOW()
   FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  [hVid, JSON.stringify(hNodes)],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id='qAyYc9DrHIqe4L9i'`,
  [JSON.stringify(hNodes), hVid],
);
await client.query('COMMIT');

await client.end();
console.log('endpoints+health ok', { metricsVid, entriesVid, shadowVid, hVid, AUTH_ID });
