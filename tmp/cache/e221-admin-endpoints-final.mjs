#!/usr/bin/env node
/**
 * Etapa 22.1 — admin metrics/entries/shadow endpoints cloned from LIST auth chain.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
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
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,'Etapa 22.1 endpoints',false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  return versionId;
}

async function registerWebhook(wfId, method, path, nodes) {
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  const webhookId = wh?.webhookId || wh?.id || randomUUID();
  await client.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [wfId]);
  await client.query(
    `INSERT INTO webhook_entity ("workflowId", "webhookPath", method, node, "webhookId", "pathLength")
     VALUES ($1::varchar,$2::text,$3::text,$4::text,$5::varchar,$6::int)
     ON CONFLICT DO NOTHING`,
    [wfId, path, method, wh?.name || 'Webhook', String(webhookId), path.split('/').length],
  );
}

const base = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='c22CacheList0000001'`);
const baseNodes = typeof base.rows[0].nodes === 'string' ? JSON.parse(base.rows[0].nodes) : base.rows[0].nodes;
const baseConn =
  typeof base.rows[0].connections === 'string'
    ? JSON.parse(base.rows[0].connections)
    : base.rows[0].connections;

const specs = [
  {
    id: 'c221CacheMetrics0001',
    name: 'SYSTEM - AI CACHE METRICS',
    path: 'system/ai-cache/metrics',
    method: 'GET',
    restoreCode: `const wh=$('Webhook').first().json||{};
const auth=$('Validar auth').first().json||{};
const q=wh.query||{};
const days=Math.min(30, Math.max(1, Number(q.days||7)||7));
const sql=\`SELECT jsonb_build_object(
  'activeMode', (SELECT value FROM app_secrets WHERE key='cache_active_mode' LIMIT 1),
  'activeVersion', (SELECT value FROM app_secrets WHERE key='cache_active_version' LIMIT 1),
  'entries', (SELECT jsonb_build_object(
     'total', COUNT(*), 'valid', COUNT(*) FILTER (WHERE status='VALID'),
     'expired', COUNT(*) FILTER (WHERE status='EXPIRED'),
     'invalidated', COUNT(*) FILTER (WHERE status='INVALIDATED'),
     'fpV2', COUNT(*) FILTER (WHERE source_fingerprint_version='source-fingerprint-v2'),
     'shadowCandidateSum', COALESCE(SUM(shadow_candidate_count),0),
     'servedHitSum', COALESCE(SUM(served_hit_count),0)
   ) FROM ai_semantic_cache_entries),
  'dependencies', (SELECT jsonb_build_object(
     'total', COUNT(*), 'entriesCovered', COUNT(DISTINCT cache_entry_id)
   ) FROM ai_semantic_cache_dependencies),
  'dependencyCoverageRate', (
     SELECT CASE WHEN v.valid=0 THEN 1.0 ELSE v.covered::float/v.valid END FROM (
       SELECT (SELECT COUNT(*) FROM ai_semantic_cache_entries WHERE status='VALID') AS valid,
              (SELECT COUNT(DISTINCT e.id) FROM ai_semantic_cache_entries e
                 JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id=e.id WHERE e.status='VALID') AS covered
     ) v),
  'daily', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.day DESC) FROM (
       SELECT day, lookups, hits, misses, shadow_candidates, shadow_candidate_count, shadow_agreements,
              false_hits, critical_false_hits, stale_candidates, invalidation_prevented_hits,
              sensitive_blocked, cacheable, non_cacheable, invalidations, evictions
       FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - \${days} ORDER BY day DESC
     ) m), '[]'::jsonb)
) AS data\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
return [{json:{data:data||row,statusCode:200,auditAction:'AI_CACHE_LOOKUP'}}];`,
  },
  {
    id: 'c221CacheEntries0001',
    name: 'SYSTEM - AI CACHE ENTRIES',
    path: 'system/ai-cache/entries',
    method: 'GET',
    restoreCode: `const wh=$('Webhook').first().json||{};
const auth=$('Validar auth').first().json||{};
const q=wh.query||{};
const status=String(q.status||'').replace(/[^A-Z_]/g,'').slice(0,20);
const reason=String(q.invalidationReason||q.reason||'').replace(/'/g,"''").slice(0,80);
const scope=String(q.scopeHashPrefix||'').replace(/[^a-f0-9]/gi,'').slice(0,16);
const limit=Math.min(100, Math.max(1, Number(q.limit||50)||50));
const where=[];
if(status) where.push("status='"+status+"'");
if(reason) where.push("invalidation_reason='"+reason+"'");
if(scope) where.push("scope_hash LIKE '"+scope+"%'");
const w=where.length?('WHERE '+where.join(' AND ')):'';
const sql=\`SELECT jsonb_build_object('items', COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)) AS data FROM (
  SELECT id, status, left(scope_hash,12) AS "scopeHashAbbrev",
         source_fingerprint_version AS "sourceFingerprintVersion",
         invalidation_reason AS "invalidationReason", ttl_policy AS "ttlPolicy",
         effective_ttl_seconds AS "effectiveTtlSeconds",
         shadow_candidate_count AS "shadowCandidateCount",
         served_hit_count AS "servedHitCount", hit_count AS "hitCount",
         created_at AS "createdAt", expires_at AS "expiresAt",
         invalidated_at AS "invalidatedAt", last_hit_at AS "lastHitAt"
  FROM ai_semantic_cache_entries \${w}
  ORDER BY created_at DESC LIMIT \${limit}
) x\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={items:[]};}}
return [{json:{data:data||{items:[]},statusCode:200,auditAction:'AI_CACHE_LOOKUP'}}];`,
  },
  {
    id: 'c221CacheShadowRun01',
    name: 'SYSTEM - AI CACHE RUN SHADOW VALIDATION',
    path: 'system/ai-cache/run-shadow-validation',
    method: 'POST',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const sql=\`SELECT jsonb_build_object(
  'ok', true,
  'message', 'Rodadas Shadow controladas via script/laboratório; produção permanece SHADOW',
  'activeMode', (SELECT value FROM app_secrets WHERE key='cache_active_mode' LIMIT 1),
  'activeVersion', (SELECT value FROM app_secrets WHERE key='cache_active_version' LIMIT 1),
  'metricsToday', (SELECT to_jsonb(m) FROM ai_cache_metrics_daily m WHERE day=CURRENT_DATE)
) AS data\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
return [{json:{data:data||row,statusCode:200,auditAction:'AI_CACHE_LOOKUP'}}];`,
  },
];

const created = {};
for (const spec of specs) {
  const nodes = structuredClone(baseNodes).map((n) => ({ ...n, id: randomUUID() }));
  const connections = structuredClone(baseConn);
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  wh.webhookId = randomUUID();
  wh.parameters = { ...wh.parameters, httpMethod: spec.method, path: spec.path, responseMode: 'responseNode' };

  nodes.find((n) => n.name === 'Restaurar request').parameters.jsCode = spec.restoreCode;
  const sqlNode = nodes.find((n) => n.name === 'SQL');
  sqlNode.parameters.query = '={{ $json.sql }}';
  sqlNode.credentials = { postgres: { id: PG_CRED, name: 'Postgres' } };
  nodes.find((n) => n.name === 'Montar data').parameters.jsCode = spec.montarCode;

  const vid = await upsertWorkflow({
    id: spec.id,
    name: spec.name,
    nodes,
    connections,
    active: true,
  });
  await registerWebhook(spec.id, spec.method, spec.path, nodes);
  created[spec.id] = vid;
  console.log('OK', spec.name, vid);
}

// schedule cleanup daily 03:00
const schedExists = await client.query(`SELECT id FROM workflow_entity WHERE id='c221CacheCleanupSched'`);
if (!schedExists.rowCount) {
  const schedNodes = [
    {
      id: randomUUID(),
      name: 'Schedule',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 0],
      parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 3 * * *' }] } },
    },
    {
      id: randomUUID(),
      name: 'IA - CACHE RUNTIME cleanup',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [260, 0],
      onError: 'continueRegularOutput',
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: 'c22CacheRuntime0001' },
        workflowInputs: { mappingMode: 'defineBelow', value: { operation: "={{ 'cleanup' }}" } },
        options: {},
      },
    },
  ];
  created.schedule = await upsertWorkflow({
    id: 'c221CacheCleanupSched',
    name: 'SCHEDULE - AI CACHE CLEANUP',
    nodes: schedNodes,
    connections: { Schedule: { main: [[{ node: 'IA - CACHE RUNTIME cleanup', type: 'main', index: 0 }]] } },
    active: true,
  });
  console.log('schedule', created.schedule);
}

writeFileSync(new URL('./_e221-admin-endpoints.json', import.meta.url), JSON.stringify(created, null, 2));
await client.end();
console.log('done');
