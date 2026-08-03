#!/usr/bin/env node
/** Part2b: update/publish/rollback + Consulta override + dataset metrics */
import crypto from 'crypto';
import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const IDS = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const VALIDAR = IDS.VALIDAR || 'NhWUkmzGhlttJC9S';

async function load(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : rows[0].connections,
  };
}
async function save(wf) {
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id],
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId],
    );
  }
}
function uuid() { return crypto.randomUUID(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
async function aid(s) {
  const { rows } = await client.query(`SELECT id, name FROM workflow_entity WHERE name ILIKE $1 LIMIT 1`, ['%' + s + '%']);
  return rows[0];
}

const listTpl = await load('SxDfJMFCQbytHHL6');
const sys = await client.query(`SELECT id, name FROM workflow_entity WHERE name IN ('SYSTEM - REGISTRAR AUDITORIA')`);
const AUDIT_ID = sys.rows[0]?.id || 'jtQvQlqRZ5X5WF9I';

function makeAuthGraph(path, method) {
  const nodes = clone(listTpl.nodes).filter((n) =>
    [
      'Webhook', 'Normalizar request', 'Validar auth', 'Auth ok?', 'Validar permissão', 'Permissão ok?',
      'Restaurar request', 'Preparar sucesso', 'Respond to Webhook', 'Preparar erro 403', 'Respond 403',
      'Preparar erro 401', 'Respond 401',
    ].includes(n.name),
  );
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.webhook') {
      n.webhookId = uuid();
      n.parameters = { path, httpMethod: method, responseMode: 'responseNode', options: {} };
    }
  }
  const c = clone(listTpl.connections);
  const conns = {
    Webhook: c.Webhook,
    'Normalizar request': c['Normalizar request'],
    'Validar auth': c['Validar auth'],
    'Auth ok?': c['Auth ok?'],
    'Validar permissão': c['Validar permissão'],
    'Permissão ok?': c['Permissão ok?'],
    'Preparar sucesso': c['Preparar sucesso'],
    'Preparar erro 401': c['Preparar erro 401'],
    'Preparar erro 403': c['Preparar erro 403'],
  };
  return { nodes, connections: conns };
}
function addNode(nodes, node) { nodes.push({ id: uuid(), ...node }); }
function wire(conns, from, to) {
  conns[from] = { main: [[{ node: to, type: 'main', index: 0 }]] };
}
async function replaceAdmin(id, path, method, build) {
  const base = makeAuthGraph(path, method);
  build(base.nodes, base.connections);
  for (const n of base.nodes) if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG };
  const wf = await load(id);
  wf.nodes = base.nodes;
  wf.connections = base.connections;
  await save(wf);
  return { id, path, method, nodes: base.nodes.length };
}

const report = {};

// UPDATE
{
  const w = await aid('AI Retrieval Update');
  report.update = await replaceAdmin(w.id, 'system/ai-retrieval/update', 'PUT', (nodes, conns) => {
    addNode(nodes, {
      name: 'Preparar update', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1200, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{}; let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
if(!body.versionId){ return [{json:{ early:true, data:{ok:false,code:'VALIDATION_ERROR',errors:[{field:'versionId',message:'obrigatório'}],fields:[{field:'versionId',message:'obrigatório'}]}, statusCode:400, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId:auth.userId||'', sessionId:auth.sessionId||'' }}]; }
return [{json:{ early:false, versionId:body.versionId, mode:body.mode||'', configurationJson:JSON.stringify(body.configuration||{}), versionLabel:body.versionLabel||'', notes:body.notes||'', requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId:auth.userId||'', sessionId:auth.sessionId||'' }}];` },
    });
    addNode(nodes, {
      name: 'Tem versionId?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [1400, 0],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'e1', leftValue: '={{ $json.early === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Checar status DRAFT', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [1620, 100],
      credentials: { postgres: PG },
      parameters: { operation: 'executeQuery', options: {}, query: `SELECT id, status, mode, version_label FROM ai_retrieval_config_versions WHERE id = NULLIF('={{ $('Preparar update').first().json.versionId }}','')::uuid` },
    });
    addNode(nodes, {
      name: 'Avaliar draft', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1840, 100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Preparar update').first().json; const row=$input.first().json||{};
if(!row.id) return [{json:{...prep, blocked:true, data:{ok:false,code:'NOT_FOUND'}, statusCode:404}}];
if(row.status!=='DRAFT') return [{json:{...prep, blocked:true, data:{ok:false,code:'NOT_DRAFT',message:'Somente DRAFT pode ser editado', status:row.status}, statusCode:400}}];
return [{json:{...prep, blocked:false}}];` },
    });
    addNode(nodes, {
      name: 'Pode editar?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [2060, 100],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'b1', leftValue: '={{ $json.blocked === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Chamar VALIDAR', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.3, position: [2280, 200],
      parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: VALIDAR, cachedResultName: 'IA - VALIDAR RETRIEVAL CONFIG' },
        workflowInputs: { mappingMode: 'defineBelow', value: { mode: '={{ $json.mode }}', configurationJson: '={{ $json.configurationJson }}', versionLabel: '={{ $json.versionLabel }}' } },
        options: { waitForSubWorkflow: true } },
    });
    addNode(nodes, {
      name: 'Validação ok?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [2500, 200],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'v1', leftValue: '={{ $json.ok === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Erro validate', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2720, 300],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Preparar update').first().json; const v=$input.first().json||{};
return [{json:{data:{ok:false,code:'VALIDATION_ERROR',errors:v.errors||[],fields:v.errors||[]},statusCode:400,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId}}];` },
    });
    addNode(nodes, {
      name: 'Executar update', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [2720, 200],
      credentials: { postgres: PG },
      parameters: { operation: 'executeQuery', options: {}, query: `UPDATE ai_retrieval_config_versions SET
  mode='={{ $('Chamar VALIDAR').first().json.mode }}',
  configuration='={{ $('Chamar VALIDAR').first().json.configurationJson }}'::jsonb,
  content_hash='={{ $('Chamar VALIDAR').first().json.contentHash }}',
  notes=COALESCE(NULLIF('={{ $('Preparar update').first().json.notes }}',''), notes),
  version_label=COALESCE(NULLIF('={{ $('Chamar VALIDAR').first().json.versionLabel || "" }}',''), version_label)
WHERE id=NULLIF('={{ $('Preparar update').first().json.versionId }}','')::uuid AND status='DRAFT'
RETURNING id, version_number, version_label, status, mode, configuration, content_hash, created_at;` },
    });
    addNode(nodes, {
      name: 'Montar update ok', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2940, 200],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Preparar update').first().json; const row=$input.first().json||{};
let configuration=row.configuration; if(typeof configuration==='string'){try{configuration=JSON.parse(configuration);}catch(_){}}
return [{json:{data:{ok:true,version:{id:row.id,versionNumber:Number(row.version_number),versionLabel:row.version_label,status:row.status,mode:row.mode,configuration,contentHash:row.content_hash,createdAt:row.created_at}},
statusCode:200,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId}}];` },
    });
    addNode(nodes, {
      name: 'Pass-through blocked', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2280, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const j=$input.first().json; return [{json:{data:j.data,statusCode:j.statusCode,requestId:j.requestId,requestStartedAtMs:j.requestStartedAtMs,method:j.method,path:j.path,userId:j.userId,sessionId:j.sessionId}}];` },
    });

    wire(conns, 'Restaurar request', 'Preparar update');
    conns['Tem versionId?'] = { main: [
      [{ node: 'Pass-through blocked', type: 'main', index: 0 }],
      [{ node: 'Checar status DRAFT', type: 'main', index: 0 }],
    ]};
    // fix: early true goes to pass-through; early false to checar
    // Preparar update -> Tem versionId?
    wire(conns, 'Preparar update', 'Tem versionId?');
    wire(conns, 'Checar status DRAFT', 'Avaliar draft');
    conns['Pode editar?'] = { main: [
      [{ node: 'Pass-through blocked', type: 'main', index: 0 }],
      [{ node: 'Chamar VALIDAR', type: 'main', index: 0 }],
    ]};
    wire(conns, 'Avaliar draft', 'Pode editar?');
    conns['Validação ok?'] = { main: [
      [{ node: 'Executar update', type: 'main', index: 0 }],
      [{ node: 'Erro validate', type: 'main', index: 0 }],
    ]};
    wire(conns, 'Chamar VALIDAR', 'Validação ok?');
    wire(conns, 'Executar update', 'Montar update ok');
    wire(conns, 'Montar update ok', 'Preparar sucesso');
    wire(conns, 'Erro validate', 'Preparar sucesso');
    wire(conns, 'Pass-through blocked', 'Preparar sucesso');
  });
}

// PUBLISH
{
  const w = await aid('AI Retrieval Publish');
  report.publish = await replaceAdmin(w.id, 'system/ai-retrieval/publish', 'POST', (nodes, conns) => {
    addNode(nodes, {
      name: 'Preparar publish', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1200, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{}; let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
const errors=[];
if(!body.versionId) errors.push({field:'versionId',message:'obrigatório'});
if(body.forceOverride===true && !String(body.overrideReason||'').trim()) errors.push({field:'overrideReason',message:'motivo obrigatório para override'});
if(errors.length) return [{json:{blocked:true,data:{ok:false,code:'VALIDATION_ERROR',errors,fields:errors},statusCode:400,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
return [{json:{blocked:false,versionId:body.versionId,forceOverride:!!body.forceOverride,overrideReason:String(body.overrideReason||'').trim(),validationRunId:body.validationRunId||null,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];` },
    });
    addNode(nodes, {
      name: 'Input ok?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [1400, 0],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'b', leftValue: '={{ $json.blocked === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Carregar versão', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [1620, 100],
      credentials: { postgres: PG },
      parameters: { operation: 'executeQuery', options: {}, query: `SELECT v.*, c.code FROM ai_retrieval_config_versions v JOIN ai_retrieval_configs c ON c.id=v.retrieval_config_id WHERE v.id=NULLIF('={{ $('Preparar publish').first().json.versionId }}','')::uuid` },
    });
    addNode(nodes, {
      name: 'Avaliar publish', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1840, 100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Preparar publish').first().json; const row=$input.first().json||{};
if(!row.id) return [{json:{...prep, blocked:true, data:{ok:false,code:'NOT_FOUND'}, statusCode:404}}];
if(!['DRAFT','VALIDATING'].includes(row.status) && !prep.forceOverride) return [{json:{...prep, blocked:true, data:{ok:false,code:'INVALID_STATUS',message:'Somente DRAFT/VALIDATING',status:row.status}, statusCode:400}}];
if(!prep.validationRunId && !prep.forceOverride) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_REQUIRED',message:'validationRunId obrigatório (ou forceOverride com motivo)'}, statusCode:400}}];
return [{json:{...prep, blocked:false, versionLabel:row.version_label, mode:row.mode, retrievalConfigId:row.retrieval_config_id}}];` },
    });
    addNode(nodes, {
      name: 'Pode publicar?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [2060, 100],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'b', leftValue: '={{ $json.blocked === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Checar run validação', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [2280, 200],
      credentials: { postgres: PG }, alwaysOutputData: true,
      parameters: { operation: 'executeQuery', options: {}, query: `SELECT id, status, retrieval_config_version, finished_at
FROM ai_test_runs
WHERE id = NULLIF('={{ $('Avaliar publish').first().json.validationRunId || "" }}','')::uuid
LIMIT 1;` },
    });
    addNode(nodes, {
      name: 'Avaliar run', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2500, 200],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Avaliar publish').first().json; const run=$input.first().json||{};
if(prep.forceOverride) return [{json:{...prep, blocked:false, overrideUsed:true}}];
if(!run.id) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_NOT_FOUND'}, statusCode:400}}];
if(!run.finished_at) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_NOT_FINISHED'}, statusCode:400}}];
if(String(run.retrieval_config_version||'') !== String(prep.versionLabel||'')) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_VERSION_MISMATCH', message:'Run não corresponde à versão', runVersion:run.retrieval_config_version, versionLabel:prep.versionLabel}, statusCode:400}}];
return [{json:{...prep, blocked:false, overrideUsed:false}}];` },
    });
    addNode(nodes, {
      name: 'Run ok?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [2720, 200],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'b', leftValue: '={{ $json.blocked === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Publicar TX', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [2940, 300],
      credentials: { postgres: PG },
      parameters: { operation: 'executeQuery', options: {}, query: `WITH target AS (
  SELECT id, retrieval_config_id, mode, version_label FROM ai_retrieval_config_versions
  WHERE id=NULLIF('={{ $('Avaliar run').first().json.versionId }}','')::uuid
), arch AS (
  UPDATE ai_retrieval_config_versions v SET status='ARCHIVED'
  FROM target t WHERE v.retrieval_config_id=t.retrieval_config_id AND v.status='PUBLISHED' AND v.id<>t.id
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(), published_by=NULLIF('={{ $('Avaliar run').first().json.userId || "" }}','')::uuid,
      validation_run_id=NULLIF('={{ $('Avaliar run').first().json.validationRunId || "" }}','')::uuid
  FROM target t WHERE v.id=t.id
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub) WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub) WHERE key='retrieval_active_version')
SELECT * FROM pub;` },
    });
    addNode(nodes, {
      name: 'Montar publish ok', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3160, 300],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Avaliar run').first().json; const row=$input.first().json||{};
const action=prep.overrideUsed?'AI_RETRIEVAL_CONFIG_PUBLISH_OVERRIDE':'AI_RETRIEVAL_CONFIG_PUBLISHED';
return [{json:{data:{ok:true,version:{id:row.id,versionLabel:row.version_label,mode:row.mode,status:row.status,publishedAt:row.published_at,versionNumber:Number(row.version_number)},overrideUsed:!!prep.overrideUsed},
statusCode:200,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId,
auditAction:action, auditResourceId:row.id}}];` },
    });
    addNode(nodes, {
      name: 'Auditar publish', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.3, position: [3380, 300],
      onError: 'continueRegularOutput',
      parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: AUDIT_ID, cachedResultName: 'SYSTEM - REGISTRAR AUDITORIA' },
        workflowInputs: { mappingMode: 'defineBelow', value: {
          action: '={{ $json.auditAction }}', resourceType: 'ai_retrieval_config_version', resourceId: '={{ $json.auditResourceId || "" }}',
          requestId: '={{ $json.requestId || "" }}', userId: '={{ $json.userId || "" }}', sessionId: '={{ $json.sessionId || "" }}',
          metadata: '={{ JSON.stringify({ overrideUsed: $json.data && $json.data.overrideUsed, reason: $("Avaliar run").first().json.overrideReason || null }) }}',
        }}, options: { waitForSubWorkflow: true } },
    });
    addNode(nodes, {
      name: 'Pass blocked', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2060, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const j=$input.first().json; return [{json:{data:j.data,statusCode:j.statusCode,requestId:j.requestId,requestStartedAtMs:j.requestStartedAtMs,method:j.method,path:j.path,userId:j.userId,sessionId:j.sessionId}}];` },
    });
    addNode(nodes, {
      name: 'Repassar publish', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3600, 300],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `return [$('Montar publish ok').first()];` },
    });

    wire(conns, 'Restaurar request', 'Preparar publish');
    conns['Input ok?'] = { main: [[{ node: 'Pass blocked', type: 'main', index: 0 }], [{ node: 'Carregar versão', type: 'main', index: 0 }]] };
    wire(conns, 'Preparar publish', 'Input ok?');
    wire(conns, 'Carregar versão', 'Avaliar publish');
    conns['Pode publicar?'] = { main: [[{ node: 'Pass blocked', type: 'main', index: 0 }], [{ node: 'Checar run validação', type: 'main', index: 0 }]] };
    wire(conns, 'Avaliar publish', 'Pode publicar?');
    wire(conns, 'Checar run validação', 'Avaliar run');
    conns['Run ok?'] = { main: [[{ node: 'Pass blocked', type: 'main', index: 0 }], [{ node: 'Publicar TX', type: 'main', index: 0 }]] };
    wire(conns, 'Avaliar run', 'Run ok?');
    wire(conns, 'Publicar TX', 'Montar publish ok');
    wire(conns, 'Montar publish ok', 'Auditar publish');
    wire(conns, 'Auditar publish', 'Repassar publish');
    wire(conns, 'Repassar publish', 'Preparar sucesso');
    wire(conns, 'Pass blocked', 'Preparar sucesso');
  });
}

// ROLLBACK
{
  const w = await aid('AI Retrieval Rollback');
  report.rollback = await replaceAdmin(w.id, 'system/ai-retrieval/rollback', 'POST', (nodes, conns) => {
    addNode(nodes, {
      name: 'Preparar rollback', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1200, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{}; let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
const reason=String(body.reason||'').trim();
const errors=[];
if(!body.targetVersionId) errors.push({field:'targetVersionId',message:'obrigatório'});
if(!reason) errors.push({field:'reason',message:'motivo obrigatório'});
if(errors.length) return [{json:{blocked:true,data:{ok:false,code:'VALIDATION_ERROR',errors,fields:errors},statusCode:400,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
return [{json:{blocked:false,targetVersionId:body.targetVersionId,reason,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];` },
    });
    addNode(nodes, {
      name: 'Input ok?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [1400, 0],
      parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'b', leftValue: '={{ $json.blocked === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }] }, looseTypeValidation: true },
    });
    addNode(nodes, {
      name: 'Executar rollback', type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [1620, 100],
      credentials: { postgres: PG },
      parameters: { operation: 'executeQuery', options: {}, query: `WITH target AS (
  SELECT * FROM ai_retrieval_config_versions WHERE id=NULLIF('={{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
), arch AS (
  UPDATE ai_retrieval_config_versions v SET status='ARCHIVED'
  FROM target t WHERE v.retrieval_config_id=t.retrieval_config_id AND v.status='PUBLISHED'
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(), published_by=NULLIF('={{ $('Preparar rollback').first().json.userId || "" }}','')::uuid
  FROM target t WHERE v.id=t.id
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub) WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub) WHERE key='retrieval_active_version')
SELECT * FROM pub;` },
    });
    addNode(nodes, {
      name: 'Montar rollback', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1840, 100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const prep=$('Preparar rollback').first().json; const row=$input.first().json||{};
if(!row.id) return [{json:{data:{ok:false,code:'ROLLBACK_FAILED'},statusCode:400,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId}}];
return [{json:{data:{ok:true,version:{id:row.id,versionLabel:row.version_label,mode:row.mode,status:row.status,publishedAt:row.published_at,versionNumber:Number(row.version_number)}},
statusCode:200,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId,
auditAction:'AI_RETRIEVAL_CONFIG_ROLLBACK', auditResourceId:row.id}}];` },
    });
    addNode(nodes, {
      name: 'Auditar rollback', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.3, position: [2060, 100],
      onError: 'continueRegularOutput',
      parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: AUDIT_ID, cachedResultName: 'SYSTEM - REGISTRAR AUDITORIA' },
        workflowInputs: { mappingMode: 'defineBelow', value: {
          action: 'AI_RETRIEVAL_CONFIG_ROLLBACK', resourceType: 'ai_retrieval_config_version', resourceId: '={{ $json.auditResourceId || "" }}',
          requestId: '={{ $json.requestId || "" }}', userId: '={{ $json.userId || "" }}', sessionId: '={{ $json.sessionId || "" }}',
          metadata: '={{ JSON.stringify({ reason: $("Preparar rollback").first().json.reason }) }}',
        }}, options: { waitForSubWorkflow: true } },
    });
    addNode(nodes, {
      name: 'Pass blocked', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1620, 0],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `const j=$input.first().json; return [{json:{data:j.data,statusCode:j.statusCode,requestId:j.requestId,requestStartedAtMs:j.requestStartedAtMs,method:j.method,path:j.path,userId:j.userId,sessionId:j.sessionId}}];` },
    });
    addNode(nodes, {
      name: 'Repassar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2280, 100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `return [$('Montar rollback').first()];` },
    });
    wire(conns, 'Restaurar request', 'Preparar rollback');
    conns['Input ok?'] = { main: [[{ node: 'Pass blocked', type: 'main', index: 0 }], [{ node: 'Executar rollback', type: 'main', index: 0 }]] };
    wire(conns, 'Preparar rollback', 'Input ok?');
    wire(conns, 'Executar rollback', 'Montar rollback');
    wire(conns, 'Montar rollback', 'Auditar rollback');
    wire(conns, 'Auditar rollback', 'Repassar');
    wire(conns, 'Repassar', 'Preparar sucesso');
    wire(conns, 'Pass blocked', 'Preparar sucesso');
  });
}

writeFileSync(new URL('./_part2b-admin.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await client.end();
