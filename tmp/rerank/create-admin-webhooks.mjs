#!/usr/bin/env node
/**
 * Create retrieval admin webhooks by cloning AI Prompts webhook skeletons
 * and replacing SQL/Code for ai_retrieval_* tables.
 */
import crypto from 'crypto';
import pg from 'pg';
import { writeFileSync } from 'fs';

const PROJECT_ID = 'WbvMM1wAedTR9qrk';
const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function nanoid(size = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

async function loadByName(name) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, settings FROM workflow_entity WHERE name=$1 LIMIT 1`,
    [name],
  );
  if (!rows[0]) throw new Error('missing template ' + name);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : rows[0].connections,
  };
}

async function upsertWorkflow(name, description, path, httpMethod, nodes, connections) {
  const { rows: existing } = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name=$1`, [
    name,
  ]);
  // ensure postgres creds + fresh webhookId
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG_CRED };
    if (n.type === 'n8n-nodes-base.webhook') {
      n.webhookId = crypto.randomUUID();
      n.parameters = { ...n.parameters, path, httpMethod, responseMode: 'responseNode', options: {} };
    }
  }
  const settings = { executionOrder: 'v1', availableInMCP: true };
  if (existing[0]) {
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, description=$3, active=true, "updatedAt"=NOW() WHERE id=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), description, existing[0].id],
    );
    if (existing[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
        [JSON.stringify(nodes), JSON.stringify(connections), existing[0].id, existing[0].activeVersionId],
      );
    }
    return { id: existing[0].id, status: 'updated' };
  }
  const id = nanoid(16);
  const versionId = crypto.randomUUID();
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO workflow_entity (
        id, name, active, nodes, connections, settings, "staticData", "pinData",
        "versionId", "triggerCount", meta, "parentFolderId", "isArchived",
        "versionCounter", description, "activeVersionId", "createdAt", "updatedAt"
      ) VALUES (
        $1,$2,false,$3::json,$4::json,$5::json,NULL,'{}'::json,
        $6::varchar,0,$7::json,NULL,false,
        1,$8,NULL,NOW(),NOW()
      )`,
      [
        id,
        name,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        JSON.stringify(settings),
        versionId,
        JSON.stringify({ aiBuilderAssisted: true, builderVariant: 'etapa20-retrieval' }),
        description,
      ],
    );
    await client.query(
      `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
       VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
      [id, PROJECT_ID],
    );
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1,$2,'etapa20',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
      [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name, description],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, active=true, "updatedAt"=NOW() WHERE id=$2`,
      [versionId, id],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return { id, status: 'created', versionId };
}

function cloneNodes(nodes) {
  return JSON.parse(JSON.stringify(nodes));
}

// ---- GET list ----
{
  const tpl = await loadByName('GET System AI Prompts');
  const nodes = cloneNodes(tpl.nodes);
  const listSql = `SELECT
  c.id AS "id",
  c.code AS "code",
  c.purpose AS "purpose",
  c.description AS "description",
  c.active AS "active",
  c.created_at AS "createdAt",
  c.updated_at AS "updatedAt",
  pub.id AS "publishedVersionId",
  pub.version_number AS "publishedVersionNumber",
  pub.version_label AS "publishedVersionLabel",
  pub.mode AS "publishedMode",
  pub.configuration AS "publishedConfiguration",
  pub.published_at AS "publishedAt",
  pub.validation_score AS "publishedValidationScore",
  pub.content_hash AS "publishedContentHash",
  COALESCE(dc.draft_count,0) AS "draftCount",
  COALESCE(vc.version_count,0) AS "versionCount",
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1),'HYBRID') AS "activeMode",
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1),'hybrid-v1') AS "activeVersionLabel"
FROM ai_retrieval_configs c
LEFT JOIN LATERAL (
  SELECT * FROM ai_retrieval_config_versions v
  WHERE v.retrieval_config_id = c.id AND v.status='PUBLISHED'
  ORDER BY v.published_at DESC NULLS LAST LIMIT 1
) pub ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS draft_count FROM ai_retrieval_config_versions v2
  WHERE v2.retrieval_config_id=c.id AND v2.status IN ('DRAFT','VALIDATING')
) dc ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS version_count FROM ai_retrieval_config_versions v3
  WHERE v3.retrieval_config_id=c.id
) vc ON true
ORDER BY c.code;`;

  const collectJs = `const rows=$input.all().map(i=>i.json).filter(j=>j&&j.id);
const norm=$('Normalizar request').first().json;
const items=rows.map(r=>({
  id:r.id, code:r.code, purpose:r.purpose, description:r.description||null, active:!!r.active,
  createdAt:r.createdAt, updatedAt:r.updatedAt,
  activeMode:r.activeMode||'HYBRID',
  activeVersionLabel:r.activeVersionLabel||null,
  publishedVersion:r.publishedVersionId?{
    id:r.publishedVersionId,
    versionNumber:Number(r.publishedVersionNumber||0),
    versionLabel:r.publishedVersionLabel,
    mode:r.publishedMode,
    configuration: typeof r.publishedConfiguration==='string'?JSON.parse(r.publishedConfiguration):r.publishedConfiguration,
    publishedAt:r.publishedAt,
    validationScore:r.publishedValidationScore!=null?Number(r.publishedValidationScore):null,
    contentHash:r.publishedContentHash,
  }:null,
  draftCount:Number(r.draftCount||0),
  versionCount:Number(r.versionCount||0),
}));
let userId='', sessionId='';
try{const a=$('Validar auth').first().json; userId=a.userId||''; sessionId=a.sessionId||'';}catch(_){}
return [{json:{data:{items}, asList:false, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId}}];`;

  for (const n of nodes) {
    if (n.name === 'Listar prompts' || n.name === 'Buscar definições' || (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query?.includes('ai_prompt_definitions'))) {
      n.name = 'Listar retrieval configs';
      n.parameters.query = listSql;
    }
    if (n.type === 'n8n-nodes-base.code' && n.parameters?.jsCode?.includes('publishedVersion')) {
      n.parameters.jsCode = collectJs;
    }
  }
  // rename postgres node if still old name
  const pgNode = nodes.find((n) => n.type === 'n8n-nodes-base.postgres' && n.parameters?.query?.includes('ai_retrieval_configs'));
  if (!pgNode) {
    const anyPg = nodes.find((n) => n.type === 'n8n-nodes-base.postgres');
    if (anyPg) {
      anyPg.name = 'Listar retrieval configs';
      anyPg.parameters.query = listSql;
    }
  }
  const collect = nodes.find((n) => n.type === 'n8n-nodes-base.code' && (n.name.includes('Coletar') || n.name.includes('Montar') || n.parameters?.jsCode?.includes('items')));
  if (collect) collect.parameters.jsCode = collectJs;

  const r = await upsertWorkflow(
    'GET System AI Retrieval',
    'GET /webhook/system/ai-retrieval — lista configs de retrieval/re-ranking.',
    'system/ai-retrieval',
    'GET',
    nodes,
    tpl.connections,
  );
  console.log('GET list', r);
}

// ---- GET detail ----
{
  const tpl = await loadByName('GET System AI Prompts Detail');
  const nodes = cloneNodes(tpl.nodes);
  const detailSql = `WITH target AS (
  SELECT
    COALESCE(
      (SELECT retrieval_config_id FROM ai_retrieval_config_versions WHERE id = NULLIF($1::text,'')::uuid),
      NULLIF($2::text,'')::uuid,
      (SELECT id FROM ai_retrieval_configs WHERE code='AI_QUERY_RETRIEVAL' LIMIT 1)
    ) AS config_id,
    NULLIF($1::text,'')::uuid AS version_id
)
SELECT
  c.id AS "definitionId", c.code, c.purpose, c.description, c.active,
  c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  v.id AS "versionId", v.version_number AS "versionNumber", v.version_label AS "versionLabel",
  v.status, v.mode, v.configuration, v.content_hash AS "contentHash",
  v.validation_run_id AS "validationRunId", v.validation_score AS "validationScore",
  v.notes, v.created_at AS "versionCreatedAt", v.published_at AS "publishedAt",
  (SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1) AS "activeMode",
  (SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1) AS "activeVersionLabel"
FROM target t
JOIN ai_retrieval_configs c ON c.id = t.config_id
LEFT JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
  AND (t.version_id IS NULL OR v.id = t.version_id)
ORDER BY v.version_number DESC NULLS LAST;`;

  // Prompts detail often uses expression params — simplify with a prepare code + query
  // Find postgres and replace; also fix param binding via code node that sets query params
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') {
      n.name = 'Buscar retrieval detail';
      // n8n postgres executeQuery often embeds expressions; use dual query mode via expressions from Normalizar
      n.parameters.query = `WITH params AS (
  SELECT
    COALESCE(
      NULLIF('{{ $json.versionId || "" }}',''),
      NULLIF('{{ $json.query?.versionId || $json.query.versionId || "" }}',''),
      ''
    ) AS version_id,
    COALESCE(
      NULLIF('{{ $json.id || "" }}',''),
      NULLIF('{{ $json.query?.id || $json.query.id || "" }}',''),
      ''
    ) AS config_id
)
SELECT
  c.id AS "definitionId", c.code, c.purpose, c.description, c.active,
  c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  v.id AS "versionId", v.version_number AS "versionNumber", v.version_label AS "versionLabel",
  v.status, v.mode, v.configuration, v.content_hash AS "contentHash",
  v.validation_run_id AS "validationRunId", v.validation_score AS "validationScore",
  v.notes, v.created_at AS "versionCreatedAt", v.published_at AS "publishedAt"
FROM ai_retrieval_configs c
LEFT JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.id = COALESCE(
  NULLIF((SELECT config_id FROM params), '')::uuid,
  (SELECT retrieval_config_id FROM ai_retrieval_config_versions WHERE id = NULLIF((SELECT version_id FROM params),'')::uuid),
  (SELECT id FROM ai_retrieval_configs WHERE code='AI_QUERY_RETRIEVAL' LIMIT 1)
)
AND (
  NULLIF((SELECT version_id FROM params),'') IS NULL
  OR v.id = NULLIF((SELECT version_id FROM params),'')::uuid
  OR NULLIF((SELECT version_id FROM params),'') = ''
)
ORDER BY v.version_number DESC;`;
      // Fix broken template — n8n uses ={{ }} not {{ }}
      n.parameters.query = `SELECT
  c.id AS "definitionId", c.code, c.purpose, c.description, c.active,
  c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  v.id AS "versionId", v.version_number AS "versionNumber", v.version_label AS "versionLabel",
  v.status, v.mode, v.configuration, v.content_hash AS "contentHash",
  v.validation_run_id AS "validationRunId", v.validation_score AS "validationScore",
  v.notes, v.created_at AS "versionCreatedAt", v.published_at AS "publishedAt"
FROM ai_retrieval_configs c
LEFT JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.code = 'AI_QUERY_RETRIEVAL'
ORDER BY v.version_number DESC;`;
    }
    if (n.type === 'n8n-nodes-base.code' && (n.parameters?.jsCode?.includes('activeVersion') || n.parameters?.jsCode?.includes('versions'))) {
      n.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r&&r.definitionId);
const norm=$('Normalizar request').first().json;
const q=norm.query||{};
const versionIdFilter=String(q.versionId||norm.versionId||'').trim();
if(!rows.length){
  return [{json:{data:{error:'RETRIEVAL_CONFIG_NOT_FOUND'}, statusCode:404, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path}}];
}
const def={
  id:rows[0].definitionId, code:rows[0].code, purpose:rows[0].purpose,
  description:rows[0].description||null, active:!!rows[0].active,
  createdAt:rows[0].createdAt, updatedAt:rows[0].updatedAt,
};
const versions=rows.filter(r=>r.versionId).map(r=>{
  let configuration=r.configuration;
  if(typeof configuration==='string'){try{configuration=JSON.parse(configuration);}catch(_){configuration={};}}
  return {
    id:r.versionId, retrievalConfigId:r.definitionId, versionNumber:Number(r.versionNumber||0),
    versionLabel:r.versionLabel, status:r.status, mode:r.mode, configuration,
    contentHash:r.contentHash, validationRunId:r.validationRunId||null,
    validationScore:r.validationScore!=null?Number(r.validationScore):null,
    notes:r.notes||null, createdAt:r.versionCreatedAt, publishedAt:r.publishedAt||null,
  };
});
const activeVersion=versions.find(v=>v.status==='PUBLISHED')||null;
const version=versionIdFilter?versions.find(v=>v.id===versionIdFilter)||null:null;
let userId='', sessionId='';
try{const a=$('Validar auth').first().json; userId=a.userId||''; sessionId=a.sessionId||'';}catch(_){}
return [{json:{data:{definition:def, versions, activeVersion, version}, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId}}];`;
    }
  }
  const r = await upsertWorkflow(
    'GET System AI Retrieval Detail',
    'GET /webhook/system/ai-retrieval/detail — detalhe e versões de retrieval.',
    'system/ai-retrieval/detail',
    'GET',
    nodes,
    tpl.connections,
  );
  console.log('GET detail', r);
}

// ---- POST create draft ----
{
  const tpl = await loadByName('POST System AI Prompts Create');
  const nodes = cloneNodes(tpl.nodes);
  // Replace core insert logic with a dedicated code+postgres path is heavy;
  // Find the main business code node and replace with retrieval create logic that uses a SQL node.
  // Simpler approach: replace the first big Code after auth restore with create logic that returns SQL fields,
  // and replace INSERT query.

  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && String(n.parameters?.query || '').toUpperCase().includes('INSERT')) {
      n.name = 'Inserir versão retrieval';
      n.parameters.query = `WITH cfg AS (
  SELECT id FROM ai_retrieval_configs WHERE code='AI_QUERY_RETRIEVAL' LIMIT 1
), nxt AS (
  SELECT COALESCE(MAX(version_number),0)+1 AS n FROM ai_retrieval_config_versions v, cfg WHERE v.retrieval_config_id=cfg.id
)
INSERT INTO ai_retrieval_config_versions
  (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, notes, created_by)
SELECT cfg.id, nxt.n,
  COALESCE(NULLIF('={{ $json.versionLabel }}',''), 'draft-v' || nxt.n),
  'DRAFT',
  COALESCE(NULLIF('={{ $json.mode }}',''), 'HYBRID_RERANK'),
  '={{ JSON.stringify($json.configuration || {}) }}'::jsonb,
  '={{ $json.contentHash }}',
  '={{ $json.notes || "" }}',
  NULLIF('={{ $json.userId || "" }}','')::uuid
FROM cfg, nxt
RETURNING id, retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, created_at;`;
    }
    if (n.type === 'n8n-nodes-base.code' && n.parameters?.jsCode && n.parameters.jsCode.includes('contentHash')) {
      // keep hash computation style; rewrite create prep if it looks like prompt create
      if (n.parameters.jsCode.includes('modelName') || n.parameters.jsCode.includes('promptDefinition')) {
        n.parameters.jsCode = `const crypto=require('crypto');
const norm=$('Normalizar request').first().json||{};
const body=norm.body||{};
let auth={};
try{auth=$('Validar auth').first().json||{};}catch(_){}
const mode=String(body.mode||'HYBRID_RERANK').toUpperCase();
const allowed=['TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK'];
if(!allowed.includes(mode)){
  return [{json:{ok:false,httpStatus:400,code:'INVALID_MODE',message:'mode inválido',requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
}
const configuration=body.configuration&&typeof body.configuration==='object'?body.configuration:{};
const clamp=(v,min,max,d)=>{const n=Number(v); return Number.isFinite(n)?Math.min(max,Math.max(min,n)):d;};
const cfg={
  mode,
  candidateLimit:clamp(configuration.candidateLimit,5,50,30),
  finalLimit:clamp(configuration.finalLimit,1,20,8),
  maxChunksPerDocument:clamp(configuration.maxChunksPerDocument,1,8,2),
  enableNeighbors:!!configuration.enableNeighbors,
  weights:{
    semantic:clamp(configuration.weights?.semantic,0,1,0.45),
    lexical:clamp(configuration.weights?.lexical,0,1,0.25),
    hybridPrior:clamp(configuration.weights?.hybridPrior,0,1,0.15),
  },
  boosts:configuration.boosts&&typeof configuration.boosts==='object'?configuration.boosts:{},
  penalties:configuration.penalties&&typeof configuration.penalties==='object'?configuration.penalties:{},
  normalization:configuration.normalization&&typeof configuration.normalization==='object'?configuration.normalization:{vector:'clip01',text:'batchMax',hybrid:'batchMinMax'},
  notes:String(body.changeSummary||body.notes||configuration.notes||'').slice(0,500),
};
// weight sum soft-check
const wsum=(cfg.weights.semantic||0)+(cfg.weights.lexical||0)+(cfg.weights.hybridPrior||0);
if(wsum<=0 || wsum>1.5){
  return [{json:{ok:false,httpStatus:400,code:'INVALID_WEIGHTS',message:'Pesos fora da faixa permitida',requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
}
const contentHash=crypto.createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
const versionLabel=String(body.versionLabel||'').trim()||null;
return [{json:{ok:true, mode, configuration:cfg, contentHash, versionLabel, notes:cfg.notes, userId:auth.userId||'', sessionId:auth.sessionId||'', requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path}}];`;
      }
    }
    if (n.type === 'n8n-nodes-base.executeWorkflow' && n.parameters?.workflowInputs?.value?.action) {
      const v = n.parameters.workflowInputs.value;
      if (String(v.action).includes('AI_PROMPT')) {
        v.action = 'AI_RETRIEVAL_DRAFT_CREATE';
      }
    }
  }
  // Fix audit action literals in code
  for (const n of nodes) {
    if (n.parameters?.jsCode?.includes('AI_PROMPT_DRAFT_CREATE')) {
      n.parameters.jsCode = n.parameters.jsCode.replaceAll('AI_PROMPT_DRAFT_CREATE', 'AI_RETRIEVAL_DRAFT_CREATE');
    }
  }

  const r = await upsertWorkflow(
    'POST System AI Retrieval Create',
    'POST /webhook/system/ai-retrieval/create — cria versão DRAFT de retrieval.',
    'system/ai-retrieval/create',
    'POST',
    nodes,
    tpl.connections,
  );
  console.log('POST create', r);
}

// ---- POST publish ----
{
  const tpl = await loadByName('POST System AI Prompts Publish');
  const nodes = cloneNodes(tpl.nodes);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && String(n.parameters?.query || '').toUpperCase().includes('UPDATE')) {
      // Replace with retrieval publish transaction via single query
      n.name = 'Publicar versão retrieval';
      n.parameters.query = `WITH target AS (
  SELECT id, retrieval_config_id, mode, version_label, status
  FROM ai_retrieval_config_versions
  WHERE id = NULLIF('={{ $json.versionId }}','')::uuid
), arch AS (
  UPDATE ai_retrieval_config_versions v
  SET status='ARCHIVED'
  FROM target t
  WHERE v.retrieval_config_id=t.retrieval_config_id AND v.status='PUBLISHED' AND v.id<>t.id
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(), published_by=NULLIF('={{ $json.userId || "" }}','')::uuid
  FROM target t
  WHERE v.id=t.id AND t.status IN ('DRAFT','VALIDATING','ARCHIVED')
  RETURNING v.id, v.retrieval_config_id, v.version_number, v.version_label, v.status, v.mode, v.configuration, v.content_hash, v.published_at
), secrets AS (
  UPDATE app_secrets SET value=(SELECT mode FROM pub) WHERE key='retrieval_active_mode'
), secrets2 AS (
  UPDATE app_secrets SET value=(SELECT version_label FROM pub) WHERE key='retrieval_active_version'
)
SELECT * FROM pub;`;
    }
    if (n.parameters?.jsCode?.includes('AI_PROMPT_PUBLISH')) {
      n.parameters.jsCode = n.parameters.jsCode
        .replaceAll('AI_PROMPT_PUBLISH_OVERRIDE', 'AI_RETRIEVAL_CONFIG_PUBLISHED')
        .replaceAll('AI_PROMPT_PUBLISH', 'AI_RETRIEVAL_CONFIG_PUBLISHED');
    }
    if (n.parameters?.workflowInputs?.value?.action && String(n.parameters.workflowInputs.value.action).includes('AI_PROMPT')) {
      n.parameters.workflowInputs.value.action = 'AI_RETRIEVAL_CONFIG_PUBLISHED';
    }
  }
  const r = await upsertWorkflow(
    'POST System AI Retrieval Publish',
    'POST /webhook/system/ai-retrieval/publish — publica versão de retrieval (única ativa).',
    'system/ai-retrieval/publish',
    'POST',
    nodes,
    tpl.connections,
  );
  console.log('POST publish', r);
}

// ---- POST rollback ----
{
  const tpl = await loadByName('POST System AI Prompts Rollback');
  const nodes = cloneNodes(tpl.nodes);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && String(n.parameters?.query || '').toUpperCase().includes('UPDATE')) {
      n.name = 'Rollback retrieval';
      n.parameters.query = `WITH target AS (
  SELECT * FROM ai_retrieval_config_versions
  WHERE id = NULLIF('={{ $json.targetVersionId }}','')::uuid
), arch AS (
  UPDATE ai_retrieval_config_versions v
  SET status='ARCHIVED'
  FROM target t
  WHERE v.retrieval_config_id=t.retrieval_config_id AND v.status='PUBLISHED'
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(), published_by=NULLIF('={{ $json.userId || "" }}','')::uuid
  FROM target t WHERE v.id=t.id
  RETURNING v.*
), s1 AS (
  UPDATE app_secrets SET value=(SELECT mode FROM pub) WHERE key='retrieval_active_mode'
), s2 AS (
  UPDATE app_secrets SET value=(SELECT version_label FROM pub) WHERE key='retrieval_active_version'
)
SELECT id, retrieval_config_id, version_number, version_label, status, mode, published_at FROM pub;`;
    }
    if (n.parameters?.jsCode?.includes('AI_PROMPT_ROLLBACK')) {
      n.parameters.jsCode = n.parameters.jsCode.replaceAll('AI_PROMPT_ROLLBACK', 'AI_RETRIEVAL_CONFIG_ROLLBACK');
    }
    if (n.parameters?.workflowInputs?.value?.action && String(n.parameters.workflowInputs.value.action).includes('PROMPT')) {
      n.parameters.workflowInputs.value.action = 'AI_RETRIEVAL_CONFIG_ROLLBACK';
    }
  }
  const r = await upsertWorkflow(
    'POST System AI Retrieval Rollback',
    'POST /webhook/system/ai-retrieval/rollback — restaura versão anterior de retrieval.',
    'system/ai-retrieval/rollback',
    'POST',
    nodes,
    tpl.connections,
  );
  console.log('POST rollback', r);
}

// ---- PUT update draft ----
{
  const tpl = await loadByName('PUT System AI Prompts Update');
  const nodes = cloneNodes(tpl.nodes);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && String(n.parameters?.query || '').toUpperCase().includes('UPDATE')) {
      n.name = 'Atualizar draft retrieval';
      n.parameters.query = `UPDATE ai_retrieval_config_versions
SET mode = COALESCE(NULLIF('={{ $json.mode }}',''), mode),
    configuration = COALESCE('={{ JSON.stringify($json.configuration || {}) }}'::jsonb, configuration),
    content_hash = COALESCE(NULLIF('={{ $json.contentHash }}',''), content_hash),
    notes = COALESCE(NULLIF('={{ $json.notes || "" }}',''), notes),
    version_label = COALESCE(NULLIF('={{ $json.versionLabel || "" }}',''), version_label)
WHERE id = NULLIF('={{ $json.versionId }}','')::uuid
  AND status = 'DRAFT'
RETURNING id, retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, created_at;`;
    }
    if (n.parameters?.jsCode?.includes('AI_PROMPT_DRAFT_UPDATE')) {
      n.parameters.jsCode = n.parameters.jsCode.replaceAll('AI_PROMPT_DRAFT_UPDATE', 'AI_RETRIEVAL_DRAFT_UPDATE');
    }
  }
  const r = await upsertWorkflow(
    'PUT System AI Retrieval Update',
    'PUT /webhook/system/ai-retrieval/update — atualiza DRAFT de retrieval.',
    'system/ai-retrieval/update',
    'PUT',
    nodes,
    tpl.connections,
  );
  console.log('PUT update', r);
}

// ---- POST validate (static ranges) ----
{
  const tpl = await loadByName('POST System AI Prompts Validate');
  const nodes = cloneNodes(tpl.nodes);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.code' && n.parameters?.jsCode && (n.parameters.jsCode.includes('errors') || n.parameters.jsCode.includes('modelName'))) {
      if (n.parameters.jsCode.includes('temperature') || n.parameters.jsCode.includes('ALLOW') || n.parameters.jsCode.length > 200) {
        n.parameters.jsCode = `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{};
const errors=[];
const warnings=[];
const mode=String(body.mode||'').toUpperCase();
const allowed=['TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK'];
if(mode && !allowed.includes(mode)) errors.push('mode inválido');
const cfg=body.configuration||{};
const n=(v)=>Number(v);
if(cfg.candidateLimit!=null && (n(cfg.candidateLimit)<5||n(cfg.candidateLimit)>50)) errors.push('candidateLimit fora de 5..50');
if(cfg.finalLimit!=null && (n(cfg.finalLimit)<1||n(cfg.finalLimit)>20)) errors.push('finalLimit fora de 1..20');
if(cfg.maxChunksPerDocument!=null && (n(cfg.maxChunksPerDocument)<1||n(cfg.maxChunksPerDocument)>8)) errors.push('maxChunksPerDocument fora de 1..8');
const w=cfg.weights||{};
for(const k of ['semantic','lexical','hybridPrior']){
  if(w[k]!=null && (n(w[k])<0||n(w[k])>1)) errors.push('peso '+k+' fora de 0..1');
}
if(Object.keys(cfg).some(k=>k.toLowerCase().includes('eval')||k==='code'||k==='expression')) errors.push('chave de configuração não permitida');
let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
const ok=errors.length===0;
return [{json:{ok, errors, warnings, versionId:body.versionId||null, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId:auth.userId||'', sessionId:auth.sessionId||'', statusCode:ok?200:400, data:{ok, errors, warnings}}}];`;
      }
    }
  }
  const r = await upsertWorkflow(
    'POST System AI Retrieval Validate',
    'POST /webhook/system/ai-retrieval/validate — validação estática de pesos/limites.',
    'system/ai-retrieval/validate',
    'POST',
    nodes,
    tpl.connections,
  );
  console.log('POST validate', r);
}

const { rows: ids } = await client.query(
  `SELECT id, name, active FROM workflow_entity WHERE name ILIKE '%AI Retrieval%' ORDER BY name`,
);
writeFileSync(new URL('./workflow-admin-ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log(JSON.stringify(ids, null, 2));
await client.end();
