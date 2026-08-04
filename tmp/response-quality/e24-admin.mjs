#!/usr/bin/env node
/**
 * Etapa 24 â€” admin evidence endpoints cloned from SYSTEM - AI CONTEXT LIST pattern.
 */
import pg from 'pg';
import { randomUUID, createHash } from 'crypto';
import { writeFileSync } from 'fs';
import './quality-helpers.mjs';

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
     VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,'Etapa 24 admin',false,NOW(),NOW())`,
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

// Prefer cache list (known working) as auth clone base
const base = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='c22CacheList0000001'`);
const baseNodes = typeof base.rows[0].nodes === 'string' ? JSON.parse(base.rows[0].nodes) : base.rows[0].nodes;
const baseConn =
  typeof base.rows[0].connections === 'string'
    ? JSON.parse(base.rows[0].connections)
    : base.rows[0].connections;

const specs = [
  {
    id: 'c24QualityList0001',
    name: 'SYSTEM - AI RESPONSE QUALITY LIST',
    path: 'system/ai-response-quality',
    method: 'GET',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const sql=\`SELECT jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object(
    'id', d.id, 'code', d.code, 'purpose', d.purpose, 'description', d.description, 'active', d.active,
    'activeMode', (SELECT value FROM app_secrets WHERE key='response_quality_active_mode' LIMIT 1),
    'activeVersionLabel', (SELECT value FROM app_secrets WHERE key='response_quality_active_version' LIMIT 1),
    'publishedVersion', (SELECT jsonb_build_object('id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'mode',v.mode,'publishedAt',v.published_at,'contentHash',v.content_hash)
      FROM ai_response_quality_config_versions v WHERE v.status='PUBLISHED' ORDER BY v.published_at DESC NULLS LAST LIMIT 1),
    'draftCount', (SELECT COUNT(*)::int FROM ai_response_quality_config_versions WHERE status='DRAFT'),
    'versionCount', (SELECT COUNT(*)::int FROM ai_response_quality_config_versions)
  ))
) AS data
FROM ai_response_quality_configs d WHERE d.code='AI_QUERY_RESPONSE_QUALITY' LIMIT 1\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={items:[]};}}
return [{json:{data:data||{items:[]},statusCode:200,auditAction:'AI_RESPONSE_QUALITY_COMPLETED'}}];`,
  },
  {
    id: 'c24QualityDetail001',
    name: 'SYSTEM - AI RESPONSE QUALITY DETAIL',
    path: 'system/ai-response-quality/detail',
    method: 'GET',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const q=$('Webhook').first().json.query||{};
const versionId=String(q.versionId||'').replace(/[^0-9a-f-]/gi,'');
const sql=\`SELECT jsonb_build_object(
  'definition', (SELECT to_jsonb(d) FROM ai_response_quality_configs d WHERE code='AI_QUERY_RESPONSE_QUALITY' LIMIT 1),
  'versions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) ORDER BY v.version_number DESC) FROM ai_response_quality_config_versions v), '[]'::jsonb),
  'activeVersion', (SELECT jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) FROM ai_response_quality_config_versions v WHERE v.status='PUBLISHED' ORDER BY v.published_at DESC NULLS LAST LIMIT 1),
  'version', CASE WHEN '\${versionId}'<>'' THEN (
    SELECT jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) FROM ai_response_quality_config_versions v WHERE v.id='\${versionId}'::uuid LIMIT 1
  ) ELSE NULL END
) AS data\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
return [{json:{data:data||{},statusCode:200,auditAction:'AI_RESPONSE_QUALITY_COMPLETED'}}];`,
  },
  {
    id: 'c24QualityCompare01',
    name: 'SYSTEM - AI RESPONSE QUALITY COMPARE',
    path: 'system/ai-response-quality/compare',
    method: 'GET',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const sql=\`SELECT jsonb_build_object(
  'published', (SELECT to_jsonb(v) FROM ai_response_quality_config_versions v WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),
  'drafts', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY version_number DESC) FROM ai_response_quality_config_versions v WHERE status='DRAFT'),'[]'::jsonb),
  'secrets', jsonb_build_object(
    'mode', (SELECT value FROM app_secrets WHERE key='response_quality_active_mode' LIMIT 1),
    'version', (SELECT value FROM app_secrets WHERE key='response_quality_active_version' LIMIT 1)
  )
) AS data\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
    montarCode: `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
return [{json:{data:data||{},statusCode:200,auditAction:'AI_RESPONSE_QUALITY_COMPLETED'}}];`,
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
  const vid = await upsertWorkflow({ id: spec.id, name: spec.name, nodes, connections, active: true });
  await registerWebhook(spec.id, spec.method, spec.path, nodes);
  created[spec.id] = vid;
  console.log('OK', spec.name);
}

// Mutating endpoints: create/update/validate/publish/rollback â€” compact custom WFs
function makeMutating({ id, name, path, method, restoreCode }) {
  return { id, name, path, method, restoreCode, montarCode: specs[1].montarCode };
}

const mutating = [
  makeMutating({
    id: 'c24QualityCreate001',
    name: 'SYSTEM - AI RESPONSE QUALITY CREATE',
    path: 'system/ai-response-quality/create',
    method: 'POST',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const mode=String(body.mode||'VALIDATE').toUpperCase();
const label=String(body.versionLabel||('rq-draft-'+Date.now())).replace(/'/g,"''").slice(0,80);
const cfg=typeof body.configuration==='object'?body.configuration:{};
const cfgJson=JSON.stringify(cfg).replace(/'/g,"''");
const notes=String(body.notes||'').replace(/'/g,"''").slice(0,500);
const hash=require('crypto').createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
const sql=\`WITH def AS (SELECT id FROM ai_response_quality_configs WHERE code='AI_QUERY_RESPONSE_QUALITY' LIMIT 1),
n AS (SELECT COALESCE(MAX(version_number),0)+1 AS vn FROM ai_response_quality_config_versions WHERE response_quality_config_id=(SELECT id FROM def)),
ins AS (
  INSERT INTO ai_response_quality_config_versions (response_quality_config_id, version_number, version_label, status, mode, configuration, content_hash, notes)
  SELECT def.id, n.vn, '\${label}', 'DRAFT', '\${mode}', '\${cfgJson}'::jsonb, '\${hash}', '\${notes}' FROM def, n
  RETURNING id, version_number, version_label, status, mode, configuration, content_hash, notes, created_at, published_at
)
SELECT jsonb_build_object('version', to_jsonb(ins)) AS data FROM ins\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
  }),
  makeMutating({
    id: 'c24QualityUpdate001',
    name: 'SYSTEM - AI RESPONSE QUALITY UPDATE',
    path: 'system/ai-response-quality/update',
    method: 'PUT',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const versionId=String(body.versionId||'').replace(/[^0-9a-f-]/gi,'');
const mode=String(body.mode||'VALIDATE').toUpperCase();
const label=String(body.versionLabel||'').replace(/'/g,"''").slice(0,80);
const cfg=typeof body.configuration==='object'?body.configuration:{};
const cfgJson=JSON.stringify(cfg).replace(/'/g,"''");
const notes=String(body.notes||'').replace(/'/g,"''").slice(0,500);
const hash=require('crypto').createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
const sql=\`WITH u AS (
  UPDATE ai_response_quality_config_versions SET mode='\${mode}', version_label=COALESCE(NULLIF('\${label}',''),version_label),
    configuration='\${cfgJson}'::jsonb, content_hash='\${hash}', notes='\${notes}'
  WHERE id='\${versionId}'::uuid AND status='DRAFT'
  RETURNING id, version_number, version_label, status, mode, configuration, content_hash, notes, created_at, published_at
) SELECT jsonb_build_object('version', to_jsonb(u)) AS data FROM u\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
  }),
  makeMutating({
    id: 'c24QualityValidate01',
    name: 'SYSTEM - AI RESPONSE QUALITY VALIDATE',
    path: 'system/ai-response-quality/validate',
    method: 'POST',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const cfg=body.configuration||{};
const modes=['DISABLED','PASSTHROUGH','VALIDATE','VALIDATE_STRICT'];
const errors=[];
const mode=String(body.mode||cfg.mode||'').toUpperCase();
if(!modes.includes(mode)) errors.push({field:'mode',message:'mode invalido'});
for(const b of ['requireSources','allowEmptyOnInsufficientContext','enableHallucinationRules','enableConsistencyRules','enableSourceValidation','enableLengthRules','enableForbiddenPhrases','passthroughAnswer']){
  if(cfg[b]!==undefined && typeof cfg[b]!=='boolean') errors.push({field:b,message:'deve ser boolean'});
}
for(const n of ['minAnswerLength','maxAnswerLength','minQualityScoreWarn','minQualityScoreError','minCitationCoverage']){
  if(cfg[n]!==undefined && !Number.isFinite(Number(cfg[n]))) errors.push({field:n,message:'numero invalido'});
}
if(Number(cfg.maxAnswerLength||0) && Number(cfg.minAnswerLength||0) && Number(cfg.maxAnswerLength)<=Number(cfg.minAnswerLength)) errors.push({field:'maxAnswerLength',message:'deve ser > minAnswerLength'});
const ok=errors.length===0;
const sql="SELECT jsonb_build_object('ok',"+ok+",'errors','"+JSON.stringify(errors).replace(/'/g,"''")+"'::jsonb,'configuration','"+JSON.stringify({...cfg,mode}).replace(/'/g,"''")+"'::jsonb) AS data";
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql,statusCode:ok?200:400}}];`,
  }),
  makeMutating({
    id: 'c24QualityPublish01',
    name: 'SYSTEM - AI RESPONSE QUALITY PUBLISH',
    path: 'system/ai-response-quality/publish',
    method: 'POST',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const versionId=String(body.versionId||'').replace(/[^0-9a-f-]/gi,'');
const sql=\`WITH arch AS (
  UPDATE ai_response_quality_config_versions SET status='ARCHIVED', archived_at=NOW()
  WHERE status='PUBLISHED' AND id<>'\${versionId}'::uuid RETURNING id
), pub AS (
  UPDATE ai_response_quality_config_versions SET status='PUBLISHED', published_at=NOW()
  WHERE id='\${versionId}'::uuid RETURNING id, version_label, mode
), sec AS (
  UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='response_quality_active_mode'
), sec2 AS (
  UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='response_quality_active_version'
)
SELECT jsonb_build_object('ok',true,'published',to_jsonb(pub),'archived',(SELECT COUNT(*) FROM arch)) AS data FROM pub\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
  }),
  makeMutating({
    id: 'c24QualityRollback1',
    name: 'SYSTEM - AI RESPONSE QUALITY ROLLBACK',
    path: 'system/ai-response-quality/rollback',
    method: 'POST',
    restoreCode: `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const target=String(body.targetVersionId||body.versionId||'').replace(/[^0-9a-f-]/gi,'');
const sql=\`WITH cur AS (
  SELECT id FROM ai_response_quality_config_versions WHERE status='PUBLISHED' LIMIT 1
), arch AS (
  UPDATE ai_response_quality_config_versions SET status='ARCHIVED', archived_at=NOW()
  WHERE id=(SELECT id FROM cur) AND id<>'\${target}'::uuid RETURNING id
), pub AS (
  UPDATE ai_response_quality_config_versions SET status='PUBLISHED', published_at=NOW()
  WHERE id='\${target}'::uuid RETURNING id, version_label, mode
), sec AS (
  UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='response_quality_active_mode'
), sec2 AS (
  UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='response_quality_active_version'
)
SELECT jsonb_build_object('ok',true,'published',to_jsonb(pub),'previousVersionId',(SELECT id FROM arch LIMIT 1)) AS data FROM pub\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`,
  }),
];

for (const spec of mutating) {
  const nodes = structuredClone(baseNodes).map((n) => ({ ...n, id: randomUUID() }));
  const connections = structuredClone(baseConn);
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  wh.webhookId = randomUUID();
  wh.parameters = { ...wh.parameters, httpMethod: spec.method, path: spec.path, responseMode: 'responseNode' };
  nodes.find((n) => n.name === 'Restaurar request').parameters.jsCode = spec.restoreCode;
  const sqlNode = nodes.find((n) => n.name === 'SQL');
  sqlNode.parameters.query = '={{ $json.sql }}';
  sqlNode.credentials = { postgres: { id: PG_CRED, name: 'Postgres' } };
  nodes.find((n) => n.name === 'Montar data').parameters.jsCode = `const row=$input.first().json||{};
let data=row.data; if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
const prep=$('Restaurar request').first().json||{};
return [{json:{data:data||{},statusCode:prep.statusCode||200,auditAction:'AI_RESPONSE_QUALITY_COMPLETED'}}];`;
  const vid = await upsertWorkflow({ id: spec.id, name: spec.name, nodes, connections, active: true });
  await registerWebhook(spec.id, spec.method, spec.path, nodes);
  created[spec.id] = vid;
  console.log('OK', spec.name);
}

// Health patch â€” add responseQuality
const health = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const hNodes = typeof health.rows[0].nodes === 'string' ? JSON.parse(health.rows[0].nodes) : health.rows[0].nodes;
const probe = hNodes.find((n) => n.name === 'Probe database');
if (probe && !String(probe.parameters.query).includes('rq_stats')) {
  probe.parameters.query = String(probe.parameters.query).replace(
    'retrieval_stats AS (',
    `rq_stats AS (
  SELECT
    COALESCE((SELECT value FROM app_secrets WHERE key='response_quality_active_mode' LIMIT 1),'VALIDATE') AS rq_mode,
    COALESCE((SELECT value FROM app_secrets WHERE key='response_quality_active_version' LIMIT 1),'evidence-v1') AS rq_version,
    (SELECT COUNT(*)::int FROM ai_response_quality_config_versions WHERE status='DRAFT') AS rq_drafts,
    (SELECT COUNT(*)::int FROM ai_response_quality_config_versions WHERE status='PUBLISHED') AS rq_published
),
retrieval_stats AS (`,
  );
  probe.parameters.query = String(probe.parameters.query).replace(
    'retrieval_stats.retrieval_last_validation,',
    `retrieval_stats.retrieval_last_validation,
  rq_stats.rq_mode,
  rq_stats.rq_version,
  rq_stats.rq_drafts,
  rq_stats.rq_published,`,
  );
  if (!String(probe.parameters.query).includes('CROSS JOIN rq_stats')) {
    if (String(probe.parameters.query).includes('CROSS JOIN evidence_stats')) {
      probe.parameters.query = String(probe.parameters.query).replace(
        'CROSS JOIN evidence_stats',
        'CROSS JOIN evidence_stats\nCROSS JOIN rq_stats',
      );
    } else {
      probe.parameters.query = String(probe.parameters.query).replace(
        'CROSS JOIN retrieval_stats',
        'CROSS JOIN retrieval_stats\nCROSS JOIN rq_stats',
      );
    }
  }
}
const prep = hNodes.find((n) => n.name === 'Prepare checks');
if (prep && !prep.parameters.jsCode.includes('rqDb')) {
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    'const cacheDb = {',
    `const rqDb = {
      mode: dbItem.rq_mode || 'VALIDATE',
      version: dbItem.rq_version || 'evidence-v1',
      drafts: Number(dbItem.rq_drafts ?? 0) || 0,
      published: Number(dbItem.rq_published ?? 0) || 0,
      available: true,
    };
const cacheDb = {`,
  );
  if (!prep.parameters.jsCode.includes('rqDb,')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace('cacheDb,', 'cacheDb,\n      rqDb,');
  }
}
const agg = hNodes.find((n) => n.name === 'Aggregate health');
if (agg && !agg.parameters.jsCode.includes('responseQuality:')) {
  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    'semanticCache: (() => {',
    `responseQuality: (() => {
    const e = partial.rqDb || {};
    const published = Number(e.published || 0);
    let status = 'ok';
    if (published !== 1) status = 'degraded';
    return {
      status,
      activeMode: e.mode || 'VALIDATE',
      activeVersion: e.version || 'response-quality-v1',
      averageQualityScore: null,
      conflictRate: null,
      consistencyOkRate: null,
      lowQualityCount: null,
      hallucinationRate: null,
      gradeDistribution: null,
      draftCount: Number(e.drafts || 0),
      multiplePublishedCount: Math.max(0, published > 1 ? published : 0),
    };
  })(),
  semanticCache: (() => {`,
  );
}

const wrapper = await client.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const wNodes = typeof wrapper.rows[0].nodes === 'string' ? JSON.parse(wrapper.rows[0].nodes) : wrapper.rows[0].nodes;
const montarAdmin = wNodes.find((x) => x.name === 'Montar resposta admin');
if (montarAdmin && !montarAdmin.parameters.jsCode.includes("'responseQuality'")) {
  montarAdmin.parameters.jsCode = montarAdmin.parameters.jsCode.replace(
    "'semanticCache']",
    "'semanticCache','responseQuality']",
  );
  if (!montarAdmin.parameters.jsCode.includes("key === 'responseQuality'")) {
    montarAdmin.parameters.jsCode = montarAdmin.parameters.jsCode.replace(
      "if (key === 'semanticCache') {",
      `if (key === 'responseQuality') {
    out.activeMode = c.activeMode || null;
    out.activeVersion = c.activeVersion || null;
    out.averageQualityScore = c.averageQualityScore != null ? Number(c.averageQualityScore) : null;
    out.conflictRate = c.conflictRate != null ? Number(c.conflictRate) : null;
    out.consistencyOkRate = c.consistencyOkRate != null ? Number(c.consistencyOkRate) : null;
    out.lowQualityCount = c.lowQualityCount != null ? Number(c.lowQualityCount) : null;
    out.hallucinationRate = c.hallucinationRate != null ? Number(c.hallucinationRate) : null;
    out.gradeDistribution = c.gradeDistribution || null;
    out.draftCount = Number(c.draftCount || 0) || 0;
    out.multiplePublishedCount = Number(c.multiplePublishedCount || 0) || 0;
  }
if (key === 'semanticCache') {`,
    );
  }
}

for (const [id, nodes] of [
  ['qAyYc9DrHIqe4L9i', hNodes],
  ['2UPHcxASp2PboC9M', wNodes],
]) {
  const versionId = randomUUID();
  const { rows } = await client.query(`SELECT name, connections FROM workflow_entity WHERE id=$1`, [id]);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,'evidence health',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(rows[0].connections), rows[0].name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(nodes), versionId, id],
  );
  await client.query('COMMIT');
  console.log('health', id, versionId);
}

// Backup workflow mention â€” append note into BACKUP if exists
const backup = await client.query(
  `SELECT id, name, nodes FROM workflow_entity WHERE name ILIKE '%BACKUP%' AND active=true LIMIT 3`,
);
for (const b of backup.rows) {
  const nodes = typeof b.nodes === 'string' ? JSON.parse(b.nodes) : b.nodes;
  const code = nodes.find((n) => n.type?.includes('code') && String(n.parameters?.jsCode || '').includes('ai_cache'));
  if (code && !code.parameters.jsCode.includes('ai_response_quality_configs')) {
    code.parameters.jsCode = code.parameters.jsCode.replace(
      'ai_cache_configs',
      'ai_cache_configs, ai_response_quality_configs, ai_response_quality_config_versions',
    );
    const versionId = randomUUID();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       SELECT $1::varchar, id, 'etapa24', $2::json, connections, name, 'include evidence tables', false, NOW(), NOW() FROM workflow_entity WHERE id=$3`,
      [versionId, JSON.stringify(nodes), b.id],
    );
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
      [JSON.stringify(nodes), versionId, b.id],
    );
    await client.query('COMMIT');
    console.log('backup patched', b.name);
  }
}

writeFileSync(new URL('./_e24-admin.json', import.meta.url), JSON.stringify(created, null, 2));
await client.end();
console.log('admin done');

