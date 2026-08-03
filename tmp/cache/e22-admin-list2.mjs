#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const AUTH = 'P5E43ZXSJiI9wFYD';
const PERM = 'yXW3rW8EbHXuprRJ';
const PREP_OK = 'zE5LRjZfbXw8Ymll';
const PREP_ERR = 'r3iSBV1ClKOxS2UI';
const AUDIT = 'jtQvQlqRZ5X5WF9I';

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

const path = 'system/ai-cache';
const method = 'GET';
const nodes = [
  { id: randomUUID(), name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(), parameters: { httpMethod: method, path, responseMode: 'responseNode', options: {} } },
  { id: randomUUID(), name: 'Validar auth', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [220, 0], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: AUTH }, workflowInputs: { mappingMode: 'defineBelow', value: { authorization: "={{ $json.headers.authorization || $json.headers.Authorization || '' }}", requestId: "={{ $json.headers['x-request-id'] || '' }}" } }, options: {} } },
  { id: randomUUID(), name: 'Auth ok?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [440, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ id: randomUUID(), leftValue: '={{ !!($json.userId || $json.ok || $json.authenticated) }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } },
  { id: randomUUID(), name: 'Validar permissão', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [660, 0], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PERM }, workflowInputs: { mappingMode: 'defineBelow', value: { userId: '={{ $json.userId }}', sessionId: '={{ $json.sessionId }}', isMaster: '={{ $json.isMaster }}', permissions: '={{ $json.permissions }}', user: '={{ $json.user }}', requiredPermission: 'editar_configuracoes', requestId: '={{ $json.requestId }}' } }, options: {} } },
  { id: randomUUID(), name: 'Permissão ok?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [880, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ id: randomUUID(), leftValue: '={{ $json.ok === true || $json.allowed === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } },
  { id: randomUUID(), name: 'Restaurar request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 0], parameters: { jsCode: `const wh=$('Webhook').first().json||{}; const auth=$('Validar auth').first().json||{}; return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now()}}];` } },
  { id: randomUUID(), name: 'SQL', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [1320, 0], credentials: { postgres: { id: PG_CRED, name: 'Postgres' } }, parameters: { operation: 'executeQuery', query: `WITH def AS (
  SELECT * FROM ai_cache_configs WHERE code='AI_QUERY_CACHE' LIMIT 1
), pub AS (
  SELECT * FROM ai_cache_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1
), stats AS (
  SELECT COUNT(*)::int AS entry_count,
         COUNT(*) FILTER (WHERE status='VALID')::int AS valid_count,
         COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired_count,
         COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated_count
  FROM ai_semantic_cache_entries
), drafts AS (
  SELECT COUNT(*)::int AS draft_count FROM ai_cache_config_versions WHERE status='DRAFT'
)
SELECT jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object(
    'id', def.id, 'code', def.code, 'purpose', def.purpose, 'description', def.description, 'active', def.active,
    'createdAt', def.created_at, 'updatedAt', def.updated_at,
    'activeMode', pub.mode, 'activeVersionLabel', pub.version_label,
    'publishedVersion', CASE WHEN pub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pub.id, 'versionNumber', pub.version_number, 'versionLabel', pub.version_label, 'mode', pub.mode,
      'publishedAt', pub.published_at, 'contentHash', pub.content_hash, 'validationScore', pub.validation_score,
      'configuration', pub.configuration
    ) END,
    'draftCount', drafts.draft_count,
    'stats', jsonb_build_object('entryCount', stats.entry_count, 'validCount', stats.valid_count, 'expiredCount', stats.expired_count, 'invalidatedCount', stats.invalidated_count)
  ))
) AS data
FROM def CROSS JOIN stats CROSS JOIN drafts LEFT JOIN pub ON true;`, options: {} } },
  { id: randomUUID(), name: 'Montar data', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1540, 0], parameters: { jsCode: `const row=$input.first().json||{}; return [{json:{data:row.data||row,statusCode:200,auditAction:'AI_CACHE_LOOKUP'}}];` } },
  { id: randomUUID(), name: 'Preparar sucesso', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [1760, 0], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_OK }, workflowInputs: { mappingMode: 'defineBelow', value: { data: '={{ $json.data }}', requestId: "={{ $('Restaurar request').first().json.requestId }}", statusCode: 200, requestStartedAtMs: "={{ $('Restaurar request').first().json.requestStartedAtMs }}", method, path: '/webhook/system/ai-cache', userId: "={{ $('Restaurar request').first().json.userId }}", sessionId: "={{ $('Restaurar request').first().json.sessionId }}" } }, options: {} } },
  { id: randomUUID(), name: 'Registrar auditoria', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [1980, 0], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: AUDIT }, workflowInputs: { mappingMode: 'defineBelow', value: { action: 'AI_CACHE_LOOKUP', success: true, statusCode: 200, requestId: "={{ $('Restaurar request').first().json.requestId }}", userId: "={{ $('Restaurar request').first().json.userId }}", sessionId: "={{ $('Restaurar request').first().json.sessionId }}", method, path: '/webhook/system/ai-cache', metadata: '={{ { op: "list" } }}', durationMs: '={{ Date.now()-Number($("Restaurar request").first().json.requestStartedAtMs||Date.now()) }}' } }, options: {} } },
  { id: randomUUID(), name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [2200, 0], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } },
  { id: randomUUID(), name: 'Erro 401', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [660, 220], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_ERR }, workflowInputs: { mappingMode: 'defineBelow', value: { code: 'UNAUTHORIZED', message: 'Não autenticado', statusCode: 401, requestId: '', requestStartedAtMs: '={{ Date.now() }}', method, path: '/webhook/system/ai-cache' } }, options: {} } },
  { id: randomUUID(), name: 'Respond 401', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [880, 220], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } },
  { id: randomUUID(), name: 'Erro 403', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [1100, 220], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: PREP_ERR }, workflowInputs: { mappingMode: 'defineBelow', value: { code: 'FORBIDDEN', message: 'Sem permissão', statusCode: 403, requestId: '', requestStartedAtMs: '={{ Date.now() }}', method, path: '/webhook/system/ai-cache' } }, options: {} } },
  { id: randomUUID(), name: 'Respond 403', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1320, 220], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} } },
];

const connections = {
  Webhook: { main: [[{ node: 'Validar auth', type: 'main', index: 0 }]] },
  'Validar auth': { main: [[{ node: 'Auth ok?', type: 'main', index: 0 }]] },
  'Auth ok?': { main: [[{ node: 'Validar permissão', type: 'main', index: 0 }], [{ node: 'Erro 401', type: 'main', index: 0 }]] },
  'Validar permissão': { main: [[{ node: 'Permissão ok?', type: 'main', index: 0 }]] },
  'Permissão ok?': { main: [[{ node: 'Restaurar request', type: 'main', index: 0 }], [{ node: 'Erro 403', type: 'main', index: 0 }]] },
  'Restaurar request': { main: [[{ node: 'SQL', type: 'main', index: 0 }]] },
  SQL: { main: [[{ node: 'Montar data', type: 'main', index: 0 }]] },
  'Montar data': { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] },
  'Preparar sucesso': { main: [[{ node: 'Registrar auditoria', type: 'main', index: 0 }]] },
  'Registrar auditoria': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
  'Erro 401': { main: [[{ node: 'Respond 401', type: 'main', index: 0 }]] },
  'Erro 403': { main: [[{ node: 'Respond 403', type: 'main', index: 0 }]] },
};

await upsertWorkflow({ id: 'c22CacheList0000001', name: 'SYSTEM - AI CACHE LIST', nodes, connections, active: true });
await client.end();
