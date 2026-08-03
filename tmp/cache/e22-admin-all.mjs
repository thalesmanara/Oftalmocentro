#!/usr/bin/env node
/**
 * Etapa 22 — remaining admin endpoints + invalidate/cleanup via runtime.
 */
import pg from 'pg';
import { randomUUID, createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { validateCacheConfiguration, defaultCacheConfig, canonicalJson, sha256 } from './cache-helpers.mjs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const AUTH = 'P5E43ZXSJiI9wFYD';
const PERM = 'yXW3rW8EbHXuprRJ';
const PREP_OK = 'zE5LRjZfbXw8Ymll';
const PREP_ERR = 'r3iSBV1ClKOxS2UI';
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const RUNTIME = 'c22CacheRuntime0001';

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
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,'Etapa 22',false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  console.log(name, versionId);
  return versionId;
}

function makeAdmin({ id, name, path, method, businessJs, useSql = false, sqlExpr = null }) {
  const nodes = [
    {
      id: randomUUID(), name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: method, path, responseMode: 'responseNode', options: {} },
    },
    {
      id: randomUUID(), name: 'Validar auth', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [220, 0],
      parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: AUTH }, workflowInputs: { mappingMode: 'defineBelow', value: { authorization: "={{ $json.headers.authorization || $json.headers.Authorization || '' }}", requestId: "={{ $json.headers['x-request-id'] || '' }}" } }, options: {} },
    },
    {
      id: randomUUID(), name: 'Auth ok?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [440, 0],
      parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ id: randomUUID(), leftValue: '={{ !!($json.userId || $json.ok || $json.authenticated) }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } },
    },
    {
      id: randomUUID(), name: 'Validar permissão', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [660, 0],
      parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PERM }, workflowInputs: { mappingMode: 'defineBelow', value: { userId: '={{ $json.userId }}', sessionId: '={{ $json.sessionId }}', isMaster: '={{ $json.isMaster }}', permissions: '={{ $json.permissions }}', user: '={{ $json.user }}', requiredPermission: 'editar_configuracoes', requestId: '={{ $json.requestId }}' } }, options: {} },
    },
    {
      id: randomUUID(), name: 'Permissão ok?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [880, 0],
      parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ id: randomUUID(), leftValue: '={{ $json.ok === true || $json.allowed === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } },
    },
    {
      id: randomUUID(), name: 'Restaurar request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 0],
      parameters: { jsCode: `const wh=$('Webhook').first().json||{}; const auth=$('Validar auth').first().json||{}; return [{json:{body:wh.body||{},query:wh.query||{},headers:wh.headers||{},userId:auth.userId,sessionId:auth.sessionId,isMaster:auth.isMaster,permissions:auth.permissions||[],requestId:auth.requestId||'',requestStartedAtMs:Date.now()}}];` },
    },
    { id: randomUUID(), name: 'Business', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1320, 0], parameters: { jsCode: businessJs } },
  ];
  if (useSql) {
    nodes.push({
      id: randomUUID(), name: 'SQL', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [1540, 0],
      credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
      parameters: { operation: 'executeQuery', query: sqlExpr || "={{ $json.sql }}", options: {} },
    });
    nodes.push({
      id: randomUUID(), name: 'Montar data', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1760, 0],
      parameters: { jsCode: `const biz=$('Business').first().json||{}; const row=$input.first().json||{}; const rows=$input.all().map(i=>i.json); let data=biz.data; if(typeof biz.finish==='function'){ /*n/a*/ } if(biz.finishMode==='rowData') data=row.data||row; if(biz.finishMode==='firstRow') data=row; if(biz.finishMode==='custom' && biz.resultKey) data=row[biz.resultKey]; if(biz.httpError){ return [{json:{error:true,statusCode:biz.statusCode||400,data:{success:false,error:{code:biz.errorCode||'VALIDATION_ERROR',message:biz.errorMessage||'Erro',fields:biz.errors||[]}}}}]; } return [{json:{data: data ?? row, statusCode: biz.statusCode||200}}];` },
    });
  }
  nodes.push({
    id: randomUUID(), name: 'Preparar sucesso', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [1980, 0],
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_OK }, workflowInputs: { mappingMode: 'defineBelow', value: { data: '={{ $json.data }}', requestId: "={{ $('Restaurar request').first().json.requestId }}", statusCode: '={{ $json.statusCode || 200 }}', requestStartedAtMs: "={{ $('Restaurar request').first().json.requestStartedAtMs }}", method, path: `/webhook/${path}`, userId: "={{ $('Restaurar request').first().json.userId }}", sessionId: "={{ $('Restaurar request').first().json.sessionId }}" } }, options: {} },
  });
  nodes.push({
    id: randomUUID(), name: 'Registrar auditoria', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [2200, 0],
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: AUDIT }, workflowInputs: { mappingMode: 'defineBelow', value: { action: "={{ $('Business').first().json.auditAction || 'AI_CACHE_LOOKUP' }}", success: true, statusCode: '={{ $json.statusCode || 200 }}', requestId: "={{ $('Restaurar request').first().json.requestId }}", userId: "={{ $('Restaurar request').first().json.userId }}", sessionId: "={{ $('Restaurar request').first().json.sessionId }}", method, path: `/webhook/${path}`, metadata: "={{ $('Business').first().json.auditMeta || {} }}", durationMs: '={{ Date.now()-Number($("Restaurar request").first().json.requestStartedAtMs||Date.now()) }}' } }, options: {} },
  });
  nodes.push({ id: randomUUID(), name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [2420, 0], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } });
  nodes.push({ id: randomUUID(), name: 'Erro 401', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [660, 240], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_ERR }, workflowInputs: { mappingMode: 'defineBelow', value: { code: 'UNAUTHORIZED', message: 'Não autenticado', statusCode: 401, requestId: '', requestStartedAtMs: '={{ Date.now() }}', method, path: `/webhook/${path}` } }, options: {} } });
  nodes.push({ id: randomUUID(), name: 'Respond 401', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [880, 240], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } });
  nodes.push({ id: randomUUID(), name: 'Erro 403', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [1100, 240], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_ERR }, workflowInputs: { mappingMode: 'defineBelow', value: { code: 'FORBIDDEN', message: 'Sem permissão', statusCode: 403, requestId: "={{ $('Validar auth').first().json.requestId || '' }}", requestStartedAtMs: '={{ Date.now() }}', method, path: `/webhook/${path}` } }, options: {} } });
  nodes.push({ id: randomUUID(), name: 'Respond 403', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1320, 240], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } });

  // Error branch for validation from Business
  nodes.push({
    id: randomUUID(), name: 'Tem erro?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1540, useSql ? -200 : 0],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ id: randomUUID(), leftValue: '={{ $json.httpError === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } },
  });
  nodes.push({
    id: randomUUID(), name: 'Respond erro', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1760, -200],
    parameters: {
      respondWith: 'json',
      options: { responseCode: "={{ $json.statusCode || 400 }}" },
      responseBody: '={{ { success:false, error:{ code:$json.errorCode||"VALIDATION_ERROR", message:$json.errorMessage||"Erro", fields:$json.errors||[] }, requestId:$("Restaurar request").first().json.requestId } }}',
    },
  });

  const connections = {
    Webhook: { main: [[{ node: 'Validar auth', type: 'main', index: 0 }]] },
    'Validar auth': { main: [[{ node: 'Auth ok?', type: 'main', index: 0 }]] },
    'Auth ok?': { main: [[{ node: 'Validar permissão', type: 'main', index: 0 }], [{ node: 'Erro 401', type: 'main', index: 0 }]] },
    'Validar permissão': { main: [[{ node: 'Permissão ok?', type: 'main', index: 0 }]] },
    'Permissão ok?': { main: [[{ node: 'Restaurar request', type: 'main', index: 0 }], [{ node: 'Erro 403', type: 'main', index: 0 }]] },
    'Restaurar request': { main: [[{ node: 'Business', type: 'main', index: 0 }]] },
    Business: { main: [[{ node: 'Tem erro?', type: 'main', index: 0 }]] },
    'Tem erro?': { main: [[{ node: 'Respond erro', type: 'main', index: 0 }], [{ node: useSql ? 'SQL' : 'Preparar sucesso', type: 'main', index: 0 }]] },
    ...(useSql ? { SQL: { main: [[{ node: 'Montar data', type: 'main', index: 0 }]] }, 'Montar data': { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] } } : {}),
    'Preparar sucesso': { main: [[{ node: 'Registrar auditoria', type: 'main', index: 0 }]] },
    'Registrar auditoria': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
    'Erro 401': { main: [[{ node: 'Respond 401', type: 'main', index: 0 }]] },
    'Erro 403': { main: [[{ node: 'Respond 403', type: 'main', index: 0 }]] },
  };
  return { id, name, nodes, connections };
}

const vids = {};

// DETAIL
vids.detail = await upsertWorkflow(makeAdmin({
  id: 'c22CacheDetail00001',
  name: 'SYSTEM - AI CACHE DETAIL',
  path: 'system/ai-cache/detail',
  method: 'GET',
  useSql: true,
  businessJs: `const q=$json.query||{};
return [{json:{
  auditAction:'AI_CACHE_LOOKUP', auditMeta:{op:'detail'}, statusCode:200, finishMode:'rowData',
  sql: \`WITH def AS (SELECT * FROM ai_cache_configs WHERE code='AI_QUERY_CACHE' LIMIT 1),
vers AS (
  SELECT id, version_number, version_label, status, mode, configuration, content_hash, validation_run_id, validation_score, notes, created_at, published_at
  FROM ai_cache_config_versions ORDER BY version_number DESC
),
active AS (SELECT * FROM ai_cache_config_versions WHERE status='PUBLISHED' LIMIT 1),
picked AS (
  SELECT * FROM ai_cache_config_versions
  WHERE (\${q.versionId ? \`id='\${String(q.versionId).replace(/'/g,"''")}'\` : 'status=\\'PUBLISHED\\''})
  LIMIT 1
)
SELECT jsonb_build_object(
  'definition', to_jsonb(def),
  'versions', COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM vers v), '[]'::jsonb),
  'activeVersion', to_jsonb(active),
  'version', to_jsonb(picked)
) AS data
FROM def CROSS JOIN active LEFT JOIN picked ON true;\`
}}];`,
}));

// CREATE
vids.create = await upsertWorkflow(makeAdmin({
  id: 'c22CacheCreate00001',
  name: 'SYSTEM - AI CACHE CREATE',
  path: 'system/ai-cache/create',
  method: 'POST',
  useSql: true,
  businessJs: `const body=$json.body||{};
const crypto=require('crypto');
const modes=['DISABLED','SHADOW','EXACT_ONLY','NORMALIZED','SEMANTIC'];
const mode=String(body.mode||'SHADOW').toUpperCase();
const cfg=body.configuration||{};
cfg.mode=mode;
const errors=[];
if(!modes.includes(mode)) errors.push({field:'mode',message:'mode inválido'});
if(typeof cfg.ttlSeconds==='string'||!Number.isFinite(Number(cfg.ttlSeconds))||Number(cfg.ttlSeconds)<=0) errors.push({field:'ttlSeconds',message:'TTL inválido'});
for(const b of ['exactEnabled','normalizedEnabled','semanticEnabled','cacheNegativeAnswers','cacheInsufficientContext','cacheConflictResponses','cacheSensitiveQueries']){
  if(cfg[b]!==undefined && typeof cfg[b]!=='boolean') errors.push({field:b,message:'deve ser boolean'});
}
if(cfg.cacheConflictResponses===true) errors.push({field:'cacheConflictResponses',message:'deve ser false'});
if(cfg.cacheInsufficientContext===true) errors.push({field:'cacheInsufficientContext',message:'deve ser false'});
if(errors.length) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'Config inválida',errors,auditAction:'AI_CACHE_CONFIG_DRAFT_CREATE'}}];
const hash=crypto.createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
const label=String(body.versionLabel||('cache-draft-'+Date.now())).replace(/'/g,"''");
const notes=String(body.notes||'').replace(/'/g,"''");
const cfgJson=JSON.stringify(cfg).replace(/'/g,"''");
const userId=$json.userId||null;
return [{json:{
  auditAction:'AI_CACHE_CONFIG_DRAFT_CREATE', auditMeta:{mode,label}, statusCode:201, finishMode:'rowData',
  sql: \`WITH def AS (SELECT id FROM ai_cache_configs WHERE code='AI_QUERY_CACHE' LIMIT 1),
n AS (SELECT COALESCE(MAX(version_number),0)+1 AS vn FROM ai_cache_config_versions),
ins AS (
  INSERT INTO ai_cache_config_versions (cache_config_id, version_number, version_label, status, mode, configuration, content_hash, notes, created_by)
  SELECT def.id, n.vn, '\${label}', 'DRAFT', '\${mode}', '\${cfgJson}'::jsonb, '\${hash}', '\${notes}', \${userId?("'"+userId+"'::uuid"):'NULL'} FROM def, n
  RETURNING *
)
SELECT jsonb_build_object('version', to_jsonb(ins)) AS data FROM ins;\`
}}];`,
}));

// VALIDATE
vids.validate = await upsertWorkflow(makeAdmin({
  id: 'c22CacheValidate001',
  name: 'SYSTEM - AI CACHE VALIDATE',
  path: 'system/ai-cache/validate',
  method: 'POST',
  useSql: false,
  businessJs: `const body=$json.body||{};
const crypto=require('crypto');
const cfg=body.configuration||{};
const mode=String(body.mode||cfg.mode||'').toUpperCase();
cfg.mode=mode;
const errors=[];
const modes=['DISABLED','SHADOW','EXACT_ONLY','NORMALIZED','SEMANTIC'];
if(!modes.includes(mode)) errors.push({field:'mode',message:'mode inválido'});
if(typeof cfg.ttlSeconds==='string'||!Number.isFinite(Number(cfg.ttlSeconds))||Number(cfg.ttlSeconds)<=0) errors.push({field:'ttlSeconds',message:'TTL inválido'});
const thr=Number(cfg.semanticThreshold);
if(cfg.semanticEnabled===true && (!Number.isFinite(thr)||thr<0.8||thr>0.99)) errors.push({field:'semanticThreshold',message:'threshold inválido'});
for(const b of ['exactEnabled','normalizedEnabled','semanticEnabled','cacheNegativeAnswers','cacheInsufficientContext','cacheConflictResponses','cacheSensitiveQueries','requireSameSources','requireSameDocumentVersions','requireSamePromptVersion','requireSameRetrievalVersion','requireSameContextVersion','requireSameModel']){
  if(cfg[b]!==undefined && typeof cfg[b]!=='boolean') errors.push({field:b,message:'deve ser boolean real'});
}
for(const n of ['maxEntries','maxEntriesPerScope']){ if(cfg[n]!==undefined && (typeof cfg[n]==='string'||!Number.isFinite(Number(cfg[n]))||Number(cfg[n])<1)) errors.push({field:n,message:'deve ser número >=1'});}
if(cfg.cacheConflictResponses===true) errors.push({field:'cacheConflictResponses',message:'deve ser false'});
if(cfg.cacheInsufficientContext===true) errors.push({field:'cacheInsufficientContext',message:'deve ser false'});
const known=new Set(['mode','exactEnabled','normalizedEnabled','semanticEnabled','semanticThreshold','ttlSeconds','maxEntries','maxEntriesPerScope','cacheNegativeAnswers','cacheInsufficientContext','cacheConflictResponses','cacheSensitiveQueries','requireSameSources','requireSameDocumentVersions','requireSamePromptVersion','requireSameRetrievalVersion','requireSameContextVersion','requireSameModel','scopeMode','cacheSchemaVersion','qdrantCollection','notes']);
for(const k of Object.keys(cfg||{})) if(!known.has(k)) errors.push({field:k,message:'campo desconhecido'});
if(errors.length) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'Config inválida',errors,auditAction:'AI_CACHE_CONFIG_VALIDATED'}}];
const contentHash=crypto.createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
return [{json:{auditAction:'AI_CACHE_CONFIG_VALIDATED',statusCode:200,data:{ok:true,configuration:cfg,contentHash,mode}}}];`,
}));

// PUBLISH
vids.publish = await upsertWorkflow(makeAdmin({
  id: 'c22CachePublish0001',
  name: 'SYSTEM - AI CACHE PUBLISH',
  path: 'system/ai-cache/publish',
  method: 'POST',
  useSql: true,
  businessJs: `const body=$json.body||{};
const versionId=String(body.versionId||'').replace(/'/g,"''");
const validationRunId=String(body.validationRunId||'').trim();
const override=body.override===true||body.forceOverride===true;
if(!versionId) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'versionId obrigatório',errors:[{field:'versionId',message:'obrigatório'}]}}];
if(!validationRunId && !override) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'validationRunId obrigatório',errors:[{field:'validationRunId',message:'obrigatório'}]}}];
const userId=$json.userId||null;
return [{json:{
  auditAction:'AI_CACHE_CONFIG_PUBLISHED', auditMeta:{versionId}, statusCode:200, finishMode:'rowData',
  sql: \`WITH arch AS (
    UPDATE ai_cache_config_versions SET status='ARCHIVED', archived_at=NOW() WHERE status='PUBLISHED' RETURNING id
  ), pub AS (
    UPDATE ai_cache_config_versions v
    SET status='PUBLISHED', published_at=NOW(), published_by=\${userId?("'"+userId+"'::uuid"):'NULL'},
        validation_run_id=\${validationRunId?("'"+validationRunId.replace(/'/g,"''")+"'::uuid"):'NULL'}
    WHERE v.id='\${versionId}'::uuid
    RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.version_number, v.configuration, v.content_hash
  ), s1 AS (
    INSERT INTO app_secrets(key,value,updated_at) VALUES ('cache_active_mode',(SELECT mode FROM pub),NOW())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
  ), s2 AS (
    INSERT INTO app_secrets(key,value,updated_at) VALUES ('cache_active_version',(SELECT version_label FROM pub),NOW())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
  )
  SELECT jsonb_build_object('ok',true,'version', jsonb_build_object(
    'id', pub.id, 'versionLabel', pub.version_label, 'mode', pub.mode, 'status', pub.status,
    'publishedAt', pub.published_at, 'versionNumber', pub.version_number
  )) AS data FROM pub;\`
}}];`,
}));

// ROLLBACK
vids.rollback = await upsertWorkflow(makeAdmin({
  id: 'c22CacheRollback001',
  name: 'SYSTEM - AI CACHE ROLLBACK',
  path: 'system/ai-cache/rollback',
  method: 'POST',
  useSql: true,
  businessJs: `const body=$json.body||{};
const target=String(body.targetVersionId||body.versionId||'').replace(/'/g,"''");
if(!target) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'targetVersionId obrigatório',errors:[{field:'targetVersionId',message:'obrigatório'}]}}];
const reason=String(body.reason||'rollback').replace(/'/g,"''");
return [{json:{
  auditAction:'AI_CACHE_CONFIG_ROLLBACK', auditMeta:{target}, statusCode:200, finishMode:'rowData',
  sql: \`WITH arch AS (
    UPDATE ai_cache_config_versions SET status='ARCHIVED', archived_at=NOW() WHERE status='PUBLISHED' RETURNING id
  ), pub AS (
    UPDATE ai_cache_config_versions v
    SET status='PUBLISHED', published_at=NOW(),
        notes = COALESCE(notes,'') || ' | rollback: \${reason}'
    WHERE v.id='\${target}'::uuid
    RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.version_number
  ), s1 AS (
    INSERT INTO app_secrets(key,value,updated_at) VALUES ('cache_active_mode',(SELECT mode FROM pub),NOW())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
  ), s2 AS (
    INSERT INTO app_secrets(key,value,updated_at) VALUES ('cache_active_version',(SELECT version_label FROM pub),NOW())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
  )
  SELECT jsonb_build_object('ok',true,'version', jsonb_build_object(
    'id', pub.id, 'versionLabel', pub.version_label, 'mode', pub.mode, 'status', pub.status,
    'publishedAt', pub.published_at, 'versionNumber', pub.version_number
  )) AS data FROM pub;\`
}}];`,
}));

// INVALIDATE
vids.invalidate = await upsertWorkflow(makeAdmin({
  id: 'c22CacheInvalidate01',
  name: 'SYSTEM - AI CACHE INVALIDATE',
  path: 'system/ai-cache/invalidate',
  method: 'POST',
  useSql: true,
  businessJs: `const body=$json.body||{};
const reason=String(body.reason||'MANUAL').replace(/'/g,"''").slice(0,80);
let sql="UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='"+reason+"' WHERE status='VALID'";
if(body.documentId) sql += " AND (source_document_ids @> '\\"\\""+String(body.documentId).replace(/'/g,"''")+"\\"\\"'::jsonb)";
else if(body.promptVersionId) sql += " AND prompt_version_id='"+String(body.promptVersionId).replace(/'/g,"''")+"'::uuid";
else if(body.contextConfigVersionId) sql += " AND context_config_version_id='"+String(body.contextConfigVersionId).replace(/'/g,"''")+"'::uuid";
else if(body.retrievalConfigVersionId) sql += " AND retrieval_config_version_id='"+String(body.retrievalConfigVersionId).replace(/'/g,"''")+"'::uuid";
else if(!body.all) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'Informe documentId/prompt/context/retrieval ou all',errors:[{field:'documentId',message:'obrigatório ou all'}]}}];
sql += " RETURNING id";
return [{json:{auditAction:'AI_CACHE_INVALIDATE',auditMeta:{reason},statusCode:200,finishMode:'custom',resultKey:'count',sql:\`WITH u AS (\${sql}) SELECT jsonb_build_object('ok',true,'invalidated',(SELECT COUNT(*) FROM u)) AS data\`}}];`,
}));

// CLEANUP
vids.cleanup = await upsertWorkflow(makeAdmin({
  id: 'c22CacheCleanup0001',
  name: 'SYSTEM - AI CACHE CLEANUP',
  path: 'system/ai-cache/cleanup',
  method: 'POST',
  useSql: true,
  businessJs: `return [{json:{
  auditAction:'AI_CACHE_EXPIRE', auditMeta:{}, statusCode:200, finishMode:'rowData',
  sql: \`WITH exp AS (
    UPDATE ai_semantic_cache_entries SET status='EXPIRED' WHERE status='VALID' AND expires_at < NOW() RETURNING id
  ), del AS (
    DELETE FROM ai_semantic_cache_entries
    WHERE status IN ('EXPIRED','INVALIDATED')
      AND COALESCE(invalidated_at, expires_at, created_at) < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT jsonb_build_object('ok',true,'expired',(SELECT COUNT(*) FROM exp),'deleted',(SELECT COUNT(*) FROM del)) AS data\`
}}];`,
}));

// COMPARE (DISABLED vs SHADOW metrics placeholder)
vids.compare = await upsertWorkflow(makeAdmin({
  id: 'c22CacheCompare0001',
  name: 'SYSTEM - AI CACHE COMPARE',
  path: 'system/ai-cache/compare',
  method: 'GET',
  useSql: true,
  businessJs: `const q=$json.query||{};
return [{json:{
  auditAction:'AI_CACHE_LOOKUP', auditMeta:{op:'compare'}, statusCode:200, finishMode:'rowData',
  sql: \`SELECT jsonb_build_object(
    'active', (SELECT jsonb_build_object('mode',mode,'versionLabel',version_label,'id',id) FROM ai_cache_config_versions WHERE status='PUBLISHED' LIMIT 1),
    'metrics7d', (
      SELECT jsonb_build_object(
        'lookups', COALESCE(SUM(lookups),0),
        'hits', COALESCE(SUM(hits),0),
        'misses', COALESCE(SUM(misses),0),
        'shadowCandidates', COALESCE(SUM(shadow_candidates),0),
        'shadowAgreements', COALESCE(SUM(shadow_agreements),0),
        'falseHits', COALESCE(SUM(false_hits),0),
        'estimatedTokensSaved', COALESCE(SUM(estimated_tokens_saved),0)
      ) FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7
    ),
    'entries', (
      SELECT jsonb_build_object(
        'valid', COUNT(*) FILTER (WHERE status='VALID'),
        'expired', COUNT(*) FILTER (WHERE status='EXPIRED'),
        'invalidated', COUNT(*) FILTER (WHERE status='INVALIDATED')
      ) FROM ai_semantic_cache_entries
    )
  ) AS data\`
}}];`,
}));

// UPDATE draft
vids.update = await upsertWorkflow(makeAdmin({
  id: 'c22CacheUpdate00001',
  name: 'SYSTEM - AI CACHE UPDATE',
  path: 'system/ai-cache/update',
  method: 'PUT',
  useSql: true,
  businessJs: `const body=$json.body||{};
const versionId=String(body.versionId||body.id||'').replace(/'/g,"''");
if(!versionId) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'versionId obrigatório',errors:[{field:'versionId',message:'obrigatório'}]}}];
const cfg=body.configuration||{};
const mode=String(body.mode||cfg.mode||'SHADOW').toUpperCase();
cfg.mode=mode;
if(typeof cfg.ttlSeconds==='string'||!Number.isFinite(Number(cfg.ttlSeconds))) return [{json:{httpError:true,statusCode:400,errorCode:'VALIDATION_ERROR',errorMessage:'TTL inválido',errors:[{field:'ttlSeconds',message:'inválido'}]}}];
const crypto=require('crypto');
const hash=crypto.createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
const cfgJson=JSON.stringify(cfg).replace(/'/g,"''");
const label=body.versionLabel?String(body.versionLabel).replace(/'/g,"''"):null;
return [{json:{
  auditAction:'AI_CACHE_CONFIG_DRAFT_UPDATE', statusCode:200, finishMode:'rowData',
  sql: \`UPDATE ai_cache_config_versions
SET configuration='\${cfgJson}'::jsonb, mode='\${mode}', content_hash='\${hash}'
\${label?", version_label='"+label+"'":''}
WHERE id='\${versionId}'::uuid AND status='DRAFT'
RETURNING jsonb_build_object('version', to_jsonb(ai_cache_config_versions.*)) AS data\`
}}];`,
}));

writeFileSync(new URL('./_admin-vids.json', import.meta.url), JSON.stringify(vids, null, 2));

// Ensure list workflow exists from previous script; recreate if missing
const listExists = await client.query(`SELECT id, "versionId" FROM workflow_entity WHERE id='c22CacheList0000001'`);
if (!listExists.rowCount) {
  console.log('list missing — create via e22-admin-list');
} else {
  vids.list = listExists.rows[0].versionId;
  await client.query(`UPDATE workflow_entity SET active=true WHERE id='c22CacheList0000001'`);
}

await client.end();
console.log('admin endpoints ready', Object.keys(vids));
