#!/usr/bin/env node
/**
 * Etapa 22 — admin cache API workflows (list/detail/create/update/validate/publish/rollback/invalidate/cleanup/compare)
 * Pattern: webhook → auth → permission → code/SQL → respond
 * Clones structure from an existing SYSTEM AI CONTEXT list workflow.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const AUTH = 'P5E43ZXSJiI9wFYD';
const PERM = 'yXW3rW8EbHXuprRJ';
const NORM = 'N3zLpj7Dij4n5p5p';
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
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,'Etapa 22 admin',false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  console.log(name, id, versionId);
  return { id, versionId };
}

// Clone SYSTEM - AI CONTEXT LIST as template if exists
const tpl = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE name ILIKE '%AI CONTEXT%' AND name ILIKE '%LIST%' OR path IS NOT NULL LIMIT 0`,
).catch(() => ({ rows: [] }));

// Find a real list workflow
const listTpl = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity
   WHERE nodes::text ILIKE '%/webhook/system/ai-context"%'
     AND nodes::text ILIKE '%Webhook%'
   ORDER BY "updatedAt" DESC LIMIT 5`,
);
console.log(
  'templates',
  listTpl.rows.map((r) => ({ id: r.id, name: r.name })),
);

// Prefer GET list
let template = null;
for (const r of listTpl.rows) {
  const nodes = typeof r.nodes === 'string' ? JSON.parse(r.nodes) : r.nodes;
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  const path = wh?.parameters?.path || '';
  console.log(' candidate', r.name, path);
  if (path === 'system/ai-context' || path.endsWith('ai-context')) {
    template = { ...r, nodes, connections: typeof r.connections === 'string' ? JSON.parse(r.connections) : r.connections };
    break;
  }
}
if (!template && listTpl.rows[0]) {
  const r = listTpl.rows[0];
  template = {
    ...r,
    nodes: typeof r.nodes === 'string' ? JSON.parse(r.nodes) : r.nodes,
    connections: typeof r.connections === 'string' ? JSON.parse(r.connections) : r.connections,
  };
}

if (!template) {
  console.error('No template found');
  process.exit(1);
}

writeFileSync(new URL('./_admin-template-meta.json', import.meta.url), JSON.stringify({ id: template.id, name: template.name }, null, 2));

function cloneAdmin({ id, name, path, method = 'GET', businessCode }) {
  const nodes = JSON.parse(JSON.stringify(template.nodes));
  const connections = JSON.parse(JSON.stringify(template.connections));
  const wh = nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  wh.parameters.path = path;
  wh.parameters.httpMethod = method;
  wh.webhookId = randomUUID();

  // Replace the main business SQL/code node — find node that queries ai_context
  for (const n of nodes) {
    if (n.parameters?.query && /ai_context/i.test(n.parameters.query)) {
      n.parameters.query = businessCode.sql || n.parameters.query;
      n.name = businessCode.sqlNodeName || n.name;
    }
    if (n.parameters?.jsCode && /ai_context|definition|versions/i.test(n.parameters.jsCode) && /Montar|Assemble|Build|Responder|Preparar data/i.test(n.name + n.parameters.jsCode.slice(0, 80))) {
      if (businessCode.jsCode) {
        n.parameters.jsCode = businessCode.jsCode;
      }
    }
  }
  return { id, name, nodes, connections };
}

// Simpler: create dedicated compact admin workflows from scratch with standard envelope
function makeAdminWorkflow({ id, name, path, method, afterAuthCode, sqlQuery }) {
  const nodes = [
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
        workflowId: { __rl: true, mode: 'id', value: AUTH },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            authorization: "={{ $json.headers.authorization || $json.headers.Authorization || '' }}",
            requestId: "={{ $json.headers['x-request-id'] || $json.query.requestId || '' }}",
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
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.ok === true || $json.authenticated === true || !!$json.userId }}',
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
      name: 'Validar permissão',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [660, 0],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: PERM },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            userId: "={{ $json.userId }}",
            sessionId: "={{ $json.sessionId }}",
            isMaster: "={{ $json.isMaster }}",
            permissions: "={{ $json.permissions }}",
            user: "={{ $json.user }}",
            requiredPermission: 'editar_configuracoes',
            requestId: "={{ $json.requestId }}",
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Permissão ok?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [880, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.ok === true || $json.allowed === true }}',
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
      name: 'Restaurar request',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 0],
      parameters: {
        jsCode: `const wh=$('Webhook').first().json||{};
const auth=$('Validar auth').first().json||{};
return [{json:{body:wh.body||{},query:wh.query||{},headers:wh.headers||{},userId:auth.userId,sessionId:auth.sessionId,isMaster:auth.isMaster,permissions:auth.permissions||[],user:auth.user||{},requestId:auth.requestId||wh.headers?.['x-request-id']||'',requestStartedAtMs:Date.now()}}];`,
      },
    },
    {
      id: randomUUID(),
      name: 'Business',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1320, 0],
      parameters: { jsCode: afterAuthCode },
    },
    ...(sqlQuery
      ? [
          {
            id: randomUUID(),
            name: 'SQL',
            type: 'n8n-nodes-base.postgres',
            typeVersion: 2.5,
            position: [1540, 0],
            credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
            parameters: { operation: 'executeQuery', query: sqlQuery, options: {} },
          },
          {
            id: randomUUID(),
            name: 'Montar data',
            type: 'n8n-nodes-base.code',
            typeVersion: 2,
            position: [1760, 0],
            parameters: {
              jsCode: `const biz=$('Business').first().json||{};
const rows=$input.all().map(i=>i.json);
return [{json:{...biz, rows, data: biz.mapData ? biz.mapData(rows) : (biz.data || {rows})}}];`,
            },
          },
        ]
      : []),
    {
      id: randomUUID(),
      name: 'Preparar sucesso',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [1980, 0],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: PREP_OK },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            data: "={{ $json.data }}",
            requestId: "={{ $('Restaurar request').first().json.requestId }}",
            statusCode: "={{ $json.statusCode || 200 }}",
            requestStartedAtMs: "={{ $('Restaurar request').first().json.requestStartedAtMs }}",
            method: method,
            path: `/webhook/${path}`,
            userId: "={{ $('Restaurar request').first().json.userId }}",
            sessionId: "={{ $('Restaurar request').first().json.sessionId }}",
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Registrar auditoria',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [2200, 0],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: AUDIT },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            action: "={{ $('Business').first().json.auditAction || 'AI_CACHE_LOOKUP' }}",
            success: true,
            statusCode: "={{ $json.statusCode || 200 }}",
            requestId: "={{ $('Restaurar request').first().json.requestId }}",
            userId: "={{ $('Restaurar request').first().json.userId }}",
            sessionId: "={{ $('Restaurar request').first().json.sessionId }}",
            method,
            path: `/webhook/${path}`,
            metadata: "={{ $('Business').first().json.auditMeta || {} }}",
            durationMs: "={{ Date.now() - Number($('Restaurar request').first().json.requestStartedAtMs||Date.now()) }}",
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [2420, 0],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Erro 401',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [660, 220],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: PREP_ERR },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            code: 'UNAUTHORIZED',
            message: 'Não autenticado',
            statusCode: 401,
            requestId: "={{ $json.requestId || '' }}",
            requestStartedAtMs: '={{ Date.now() }}',
            method,
            path: `/webhook/${path}`,
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Respond 401',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [880, 220],
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
    },
    {
      id: randomUUID(),
      name: 'Erro 403',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      position: [1100, 220],
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: PREP_ERR },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            code: 'FORBIDDEN',
            message: 'Sem permissão',
            statusCode: 403,
            requestId: "={{ $('Validar auth').first().json.requestId || '' }}",
            requestStartedAtMs: '={{ Date.now() }}',
            method,
            path: `/webhook/${path}`,
          },
        },
        options: {},
      },
    },
    {
      id: randomUUID(),
      name: 'Respond 403',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1320, 220],
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
    },
  ];

  const connections = {
    Webhook: { main: [[{ node: 'Validar auth', type: 'main', index: 0 }]] },
    'Validar auth': { main: [[{ node: 'Auth ok?', type: 'main', index: 0 }]] },
    'Auth ok?': {
      main: [
        [{ node: 'Validar permissão', type: 'main', index: 0 }],
        [{ node: 'Erro 401', type: 'main', index: 0 }],
      ],
    },
    'Validar permissão': { main: [[{ node: 'Permissão ok?', type: 'main', index: 0 }]] },
    'Permissão ok?': {
      main: [
        [{ node: 'Restaurar request', type: 'main', index: 0 }],
        [{ node: 'Erro 403', type: 'main', index: 0 }],
      ],
    },
    'Restaurar request': { main: [[{ node: 'Business', type: 'main', index: 0 }]] },
    Business: { main: [[{ node: sqlQuery ? 'SQL' : 'Preparar sucesso', type: 'main', index: 0 }]] },
    ...(sqlQuery
      ? {
          SQL: { main: [[{ node: 'Montar data', type: 'main', index: 0 }]] },
          'Montar data': { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] },
        }
      : {}),
    'Preparar sucesso': { main: [[{ node: 'Registrar auditoria', type: 'main', index: 0 }]] },
    'Registrar auditoria': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
    'Erro 401': { main: [[{ node: 'Respond 401', type: 'main', index: 0 }]] },
    'Erro 403': { main: [[{ node: 'Respond 403', type: 'main', index: 0 }]] },
  };

  return { id, name, nodes, connections };
}

const vids = {};

vids.list = await upsertWorkflow(
  makeAdminWorkflow({
    id: 'c22CacheList0000001',
    name: 'SYSTEM - AI CACHE LIST',
    path: 'system/ai-cache',
    method: 'GET',
    afterAuthCode: `const def=(await (async()=>($input.first().json))());
return [{json:{
  auditAction:'AI_CACHE_LOOKUP',
  auditMeta:{op:'list'},
  statusCode:200,
  data:null,
  needSql:true
}}];`,
    sqlQuery: `WITH def AS (
  SELECT * FROM ai_cache_configs WHERE code='AI_QUERY_CACHE' LIMIT 1
), pub AS (
  SELECT * FROM ai_cache_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1
), stats AS (
  SELECT
    COUNT(*)::int AS entry_count,
    COUNT(*) FILTER (WHERE status='VALID')::int AS valid_count,
    COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired_count,
    COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated_count
  FROM ai_semantic_cache_entries
), drafts AS (
  SELECT COUNT(*)::int AS draft_count FROM ai_cache_config_versions WHERE status='DRAFT'
)
SELECT jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object(
    'id', def.id,
    'code', def.code,
    'purpose', def.purpose,
    'description', def.description,
    'active', def.active,
    'createdAt', def.created_at,
    'updatedAt', def.updated_at,
    'activeMode', pub.mode,
    'activeVersionLabel', pub.version_label,
    'publishedVersion', CASE WHEN pub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pub.id, 'versionNumber', pub.version_number, 'versionLabel', pub.version_label,
      'mode', pub.mode, 'publishedAt', pub.published_at, 'contentHash', pub.content_hash,
      'validationScore', pub.validation_score, 'configuration', pub.configuration
    ) END,
    'draftCount', drafts.draft_count,
    'stats', jsonb_build_object(
      'entryCount', stats.entry_count,
      'validCount', stats.valid_count,
      'expiredCount', stats.expired_count,
      'invalidatedCount', stats.invalidated_count
    )
  ))
) AS data
FROM def
CROSS JOIN stats
CROSS JOIN drafts
LEFT JOIN pub ON true;`,
  }),
);

// Fix list Montar data to use SQL data field
{
  const { rows } = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='c22CacheList0000001'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const montar = nodes.find((n) => n.name === 'Montar data');
  if (montar) {
    montar.parameters.jsCode = `const row=$input.first().json||{};
const data=row.data||row;
return [{json:{data, statusCode:200}}];`;
  }
  const biz = nodes.find((n) => n.name === 'Business');
  biz.parameters.jsCode = `return [{json:{auditAction:'AI_CACHE_LOOKUP', auditMeta:{op:'list'}, statusCode:200}}];`;
  vids.list = await upsertWorkflow({
    id: 'c22CacheList0000001',
    name: 'SYSTEM - AI CACHE LIST',
    nodes,
    connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
  });
}

writeFileSync(new URL('./_admin-vids.json', import.meta.url), JSON.stringify(vids, null, 2));
await client.end();
console.log('admin list done');
