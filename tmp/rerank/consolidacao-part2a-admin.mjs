#!/usr/bin/env node
/**
 * Consolidação part2: admin endpoints limpos + Consulta override + métricas dataset
 */
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
function uuid() {
  return crypto.randomUUID();
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// Resolve SYSTEM prep/audit ids
const sys = await client.query(
  `SELECT id, name FROM workflow_entity WHERE name IN (
    'SYSTEM - PREPARAR RESPOSTA SUCESSO','SYSTEM - PREPARAR RESPOSTA ERRO','SYSTEM - REGISTRAR AUDITORIA'
  )`,
);
const SYS = Object.fromEntries(sys.rows.map((r) => [r.name, r.id]));

function authSkeleton(path, method) {
  // Clone from GET System AI Retrieval
  return null;
}

const listTpl = await load('SxDfJMFCQbytHHL6');

function makeAuthGraph(path, method) {
  const nodes = clone(listTpl.nodes);
  const connections = clone(listTpl.connections);
  // remove list-specific nodes
  const keep = new Set([
    'Webhook',
    'Normalizar request',
    'Validar auth',
    'Auth ok?',
    'Validar permissão',
    'Permissão ok?',
    'Restaurar request',
    'Preparar sucesso',
    'Respond to Webhook',
    'Preparar erro 403',
    'Respond 403',
    'Preparar erro 401',
    'Respond 401',
  ]);
  const filtered = nodes.filter((n) => keep.has(n.name));
  for (const n of filtered) {
    if (n.type === 'n8n-nodes-base.webhook') {
      n.webhookId = uuid();
      n.parameters = { path, httpMethod: method, responseMode: 'responseNode', options: {} };
    }
    if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG };
  }
  // clean connections to only auth path ending at Restaurar request
  const conns = {
    Webhook: connections.Webhook,
    'Normalizar request': connections['Normalizar request'],
    'Validar auth': connections['Validar auth'],
    'Auth ok?': connections['Auth ok?'],
    'Validar permissão': connections['Validar permissão'],
    'Permissão ok?': connections['Permissão ok?'],
    'Preparar sucesso': connections['Preparar sucesso'],
    'Preparar erro 401': connections['Preparar erro 401'],
    'Preparar erro 403': connections['Preparar erro 403'],
  };
  return { nodes: filtered, connections: conns };
}

function addNode(nodes, node) {
  nodes.push({ id: uuid(), ...node });
}
function wire(conns, from, to, out = 0) {
  if (!conns[from]) conns[from] = { main: [[]] };
  while (conns[from].main.length <= out) conns[from].main.push([]);
  conns[from].main[out] = [{ node: to, type: 'main', index: 0 }];
}
function wireMulti(conns, from, outs) {
  conns[from] = { main: outs.map((t) => [{ node: t, type: 'main', index: 0 }]) };
}

async function replaceAdmin(id, path, method, buildBusiness) {
  const base = makeAuthGraph(path, method);
  const { nodes, connections } = base;
  buildBusiness(nodes, connections);
  // ensure postgres creds
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG };
  }
  const wf = await load(id);
  wf.nodes = nodes;
  wf.connections = connections;
  await save(wf);
  return { id, path, method, nodeCount: nodes.length };
}

const report = {};

async function aid(substr) {
  const { rows } = await client.query(
    `SELECT id, name FROM workflow_entity WHERE name ILIKE $1 LIMIT 1`,
    ['%' + substr + '%'],
  );
  return rows[0];
}

// ---- VALIDATE endpoint ----
{
  const v = await aid('AI Retrieval Validate');
  report.validate = await replaceAdmin(v.id, 'system/ai-retrieval/validate', 'POST', (nodes, conns) => {
    addNode(nodes, {
      name: 'Preparar validate',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{};
let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
return [{json:{
  mode: body.mode|| (body.configuration&&body.configuration.mode) || '',
  configurationJson: JSON.stringify(body.configuration||{}),
  versionLabel: body.versionLabel||'',
  versionId: body.versionId||null,
  requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method, path: norm.path, userId: auth.userId||'', sessionId: auth.sessionId||'',
}}];`,
      },
    });
    addNode(nodes, {
      name: 'Chamar VALIDAR',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.3,
      position: [1420, 0],
      parameters: {
        mode: 'once', source: 'database',
        workflowId: { __rl: true, mode: 'id', value: VALIDAR, cachedResultName: 'IA - VALIDAR RETRIEVAL CONFIG' },
        workflowInputs: { mappingMode: 'defineBelow', value: {
          mode: '={{ $json.mode }}',
          configurationJson: '={{ $json.configurationJson }}',
          versionLabel: '={{ $json.versionLabel }}',
        }},
        options: { waitForSubWorkflow: true },
      },
    });
    addNode(nodes, {
      name: 'Montar validate response',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1640, 0],
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `const prep=$('Preparar validate').first().json;
const v=$input.first().json||{};
const ok=v.ok===true;
return [{json:{
  data:{ ok, errors:v.errors||[], warnings:v.warnings||[], fields:v.fields||v.errors||[], normalized: ok?v.normalized:undefined, contentHash: ok?v.contentHash:undefined },
  statusCode: ok?200:400,
  requestId: prep.requestId, requestStartedAtMs: prep.requestStartedAtMs,
  method: prep.method, path: prep.path, userId: prep.userId, sessionId: prep.sessionId,
}}];`,
      },
    });
    wire(conns, 'Restaurar request', 'Preparar validate');
    wire(conns, 'Preparar validate', 'Chamar VALIDAR');
    wire(conns, 'Chamar VALIDAR', 'Montar validate response');
    wire(conns, 'Montar validate response', 'Preparar sucesso');
  });
}

// ---- CREATE ----
{
  const w = await aid('AI Retrieval Create');
  report.create = await replaceAdmin(w.id, 'system/ai-retrieval/create', 'POST', (nodes, conns) => {
    addNode(nodes, {
      name: 'Preparar create',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 0],
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `const norm=$('Normalizar request').first().json||{};
const body=norm.body||{};
let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
return [{json:{
  mode: body.mode||'',
  configurationJson: JSON.stringify(body.configuration||{}),
  versionLabel: body.versionLabel||body.changeSummary||'',
  notes: body.notes||body.changeSummary||'',
  requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method, path: norm.path, userId: auth.userId||'', sessionId: auth.sessionId||'',
}}];`,
      },
    });
    addNode(nodes, {
      name: 'Chamar VALIDAR',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.3,
      position: [1420, 0],
      parameters: {
        mode: 'once', source: 'database',
        workflowId: { __rl: true, mode: 'id', value: VALIDAR, cachedResultName: 'IA - VALIDAR RETRIEVAL CONFIG' },
        workflowInputs: { mappingMode: 'defineBelow', value: {
          mode: '={{ $json.mode }}', configurationJson: '={{ $json.configurationJson }}', versionLabel: '={{ $json.versionLabel }}',
        }},
        options: { waitForSubWorkflow: true },
      },
    });
    addNode(nodes, {
      name: 'Validação ok?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [1640, 0],
      parameters: {
        conditions: {
          combinator: 'and',
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'v1', leftValue: '={{ $json.ok === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        },
        looseTypeValidation: true,
      },
    });
    addNode(nodes, {
      name: 'Erro validação',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1860, 120],
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `const prep=$('Preparar create').first().json; const v=$input.first().json||{};
return [{json:{ data:{ ok:false, code:'VALIDATION_ERROR', errors:v.errors||[], fields:v.errors||[] }, statusCode:400,
  requestId:prep.requestId, requestStartedAtMs:prep.requestStartedAtMs, method:prep.method, path:prep.path, userId:prep.userId, sessionId:prep.sessionId }}];`,
      },
    });
    addNode(nodes, {
      name: 'Inserir DRAFT',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1860, 0],
      credentials: { postgres: PG },
      parameters: {
        operation: 'executeQuery',
        options: {},
        query: `WITH cfg AS (SELECT id FROM ai_retrieval_configs WHERE code='AI_QUERY_RETRIEVAL' LIMIT 1),
nxt AS (SELECT COALESCE(MAX(version_number),0)+1 AS n FROM ai_retrieval_config_versions v, cfg WHERE v.retrieval_config_id=cfg.id),
ins AS (
  INSERT INTO ai_retrieval_config_versions
    (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, notes, created_by)
  SELECT cfg.id, nxt.n,
    COALESCE(NULLIF('={{ $('Chamar VALIDAR').first().json.versionLabel || "" }}',''), 'draft-v' || nxt.n::text),
    'DRAFT',
    '={{ $('Chamar VALIDAR').first().json.mode }}',
    '={{ $('Chamar VALIDAR').first().json.configurationJson }}'::jsonb,
    '={{ $('Chamar VALIDAR').first().json.contentHash }}',
    '={{ $('Preparar create').first().json.notes || "" }}',
    NULLIF('={{ $('Preparar create').first().json.userId || "" }}','')::uuid
  FROM cfg, nxt
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_retrieval_config_versions x, cfg c2
    WHERE x.retrieval_config_id=c2.id
      AND x.version_label = COALESCE(NULLIF('={{ $('Chamar VALIDAR').first().json.versionLabel || "" }}',''), 'draft-v' || nxt.n::text)
  )
  RETURNING *
)
SELECT * FROM ins;`,
      },
    });
    addNode(nodes, {
      name: 'Montar create result',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2080, 0],
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `const prep=$('Preparar create').first().json;
const row=$input.first().json||{};
if(!row.id){
  return [{json:{data:{ok:false,code:'DUPLICATE_OR_FAILED',message:'Não foi possível criar (label duplicado?)'},statusCode:409,
    requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId}}];
}
let configuration=row.configuration; if(typeof configuration==='string'){try{configuration=JSON.parse(configuration);}catch(_){}}
return [{json:{data:{ok:true, version:{ id:row.id, versionNumber:Number(row.version_number), versionLabel:row.version_label, status:row.status, mode:row.mode, configuration, contentHash:row.content_hash, createdAt:row.created_at }},
  statusCode:201, requestId:prep.requestId, requestStartedAtMs:prep.requestStartedAtMs, method:prep.method, path:prep.path, userId:prep.userId, sessionId:prep.sessionId,
  auditAction:'AI_RETRIEVAL_CONFIG_DRAFT_CREATE', auditResourceId:row.id }}];`,
      },
    });
    addNode(nodes, {
      name: 'Auditar create',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.3,
      position: [2300, 0],
      onError: 'continueRegularOutput',
      parameters: {
        mode: 'once', source: 'database',
        workflowId: { __rl: true, mode: 'id', value: SYS['SYSTEM - REGISTRAR AUDITORIA'] || 'jtQvQlqRZ5X5WF9I', cachedResultName: 'SYSTEM - REGISTRAR AUDITORIA' },
        workflowInputs: { mappingMode: 'defineBelow', value: {
          action: 'AI_RETRIEVAL_CONFIG_DRAFT_CREATE',
          resourceType: 'ai_retrieval_config_version',
          resourceId: '={{ $json.auditResourceId || "" }}',
          requestId: '={{ $json.requestId || "" }}',
          userId: '={{ $json.userId || "" }}',
          sessionId: '={{ $json.sessionId || "" }}',
          metadata: '={{ JSON.stringify({ statusCode: $json.statusCode }) }}',
        }},
        options: { waitForSubWorkflow: true },
      },
    });
    addNode(nodes, {
      name: 'Repassar create',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2520, 0],
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `return [$('Montar create result').first()];`,
      },
    });

    wire(conns, 'Restaurar request', 'Preparar create');
    wire(conns, 'Preparar create', 'Chamar VALIDAR');
    wire(conns, 'Chamar VALIDAR', 'Validação ok?');
    // if true / false
    if (!conns['Validação ok?']) conns['Validação ok?'] = { main: [[], []] };
    conns['Validação ok?'].main = [
      [{ node: 'Inserir DRAFT', type: 'main', index: 0 }],
      [{ node: 'Erro validação', type: 'main', index: 0 }],
    ];
    wire(conns, 'Erro validação', 'Preparar sucesso');
    wire(conns, 'Inserir DRAFT', 'Montar create result');
    wire(conns, 'Montar create result', 'Auditar create');
    wire(conns, 'Auditar create', 'Repassar create');
    wire(conns, 'Repassar create', 'Preparar sucesso');
  });
}

writeFileSync(new URL('./_part2a.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await client.end();
