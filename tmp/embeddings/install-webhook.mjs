#!/usr/bin/env node
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import pg from 'pg';

const WF_ID = 'A3ps15dPHWoN2LZf';
const REPROCESSAR = 'x4bw9IQ5vwJSFh0y';
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const respondHeaders = {
  entries: [
    {
      name: 'X-Request-Id',
      value:
        '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}',
    },
    {
      name: 'X-Response-Time-Ms',
      value:
        '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}',
    },
  ],
};

function n(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

const nodes = [
  n('Webhook', 'n8n-nodes-base.webhook', 2.1, [0, 192], {
    path: 'system/embeddings/reprocess',
    httpMethod: 'POST',
    responseMode: 'responseNode',
    options: {},
  }),
  n('Normalizar request', 'n8n-nodes-base.executeWorkflow', 1.3, [224, 192], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'SYSTEM - NORMALIZAR REQUEST', mode: 'id', value: 'N3zLpj7Dij4n5p5p' },
  }),
  n('Validar auth', 'n8n-nodes-base.executeWorkflow', 1.3, [448, 192], {
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: 'P5E43ZXSJiI9wFYD', cachedResultName: 'AUTH - VALIDAR TOKEN' },
    mode: 'once',
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        authorization: "={{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}",
        requestId: "={{ $json.requestId || '' }}",
      },
    },
    options: { waitForSubWorkflow: true },
  }),
  n('Auth ok?', 'n8n-nodes-base.if', 2.3, [672, 192], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'a1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
      combinator: 'and',
    },
    looseTypeValidation: true,
  }),
  n('Validar permissão', 'n8n-nodes-base.executeWorkflow', 1.3, [896, 96], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'AUTH - VALIDAR PERMISSÃO', mode: 'id', value: 'yXW3rW8EbHXuprRJ' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        isMaster: '={{ $json.user ? $json.user.isMaster === true : false }}',
        permissions: '={{ $json.permissions || ($json.user && $json.user.permissions) || [] }}',
        requiredAnyOf: '={{ [] }}',
        requiredPermission: 'editar_configuracoes',
        sessionId: "={{ $json.sessionId || '' }}",
        user: '={{ $json.user || null }}',
        userId: "={{ $json.userId || ($json.user && $json.user.id) || '' }}",
        requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}",
      },
    },
  }),
  n('Permissão ok?', 'n8n-nodes-base.if', 2.3, [1120, 96], {
    conditions: {
      combinator: 'and',
      conditions: [{ id: 'p1', leftValue: '={{ $json.ok }}', operator: { operation: 'true', type: 'boolean' }, rightValue: true }],
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    },
    looseTypeValidation: true,
  }),
  n('Restaurar request', 'n8n-nodes-base.code', 2, [1344, 0], {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: "return [$('Normalizar request').first()];",
  }),
  n('Chamar REPROCESSAR', 'n8n-nodes-base.executeWorkflow', 1.3, [1568, 0], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: REPROCESSAR, cachedResultName: 'EMBEDDING - REPROCESSAR' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        requestId: "={{ $('Normalizar request').first().json.requestId }}",
        userId: "={{ $('Validar auth').first().json.userId || '' }}",
        sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
        force: "={{ ($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.force) !== false }}",
        limit: "={{ Number(($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.limit) || 20) }}",
      },
    },
  }),
  n('Montar resposta', 'n8n-nodes-base.code', 2, [1792, 0], {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const r = $input.first().json || {};
const norm = $('Normalizar request').first().json;
let userId = ''; let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: { ok: r.ok !== false, processed: Number(r.processed || 0), status: r.status || 'DONE', requestId: r.requestId || norm.requestId },
  asList: false,
  statusCode: 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
} }];`,
  }),
  n('Preparar sucesso', 'n8n-nodes-base.executeWorkflow', 1.3, [2016, 0], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR SUCESSO', mode: 'id', value: 'zE5LRjZfbXw8Ymll' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        asList: '={{ $json.asList }}',
        data: '={{ $json.data }}',
        requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId }}",
        statusCode: '={{ $json.statusCode }}',
        requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
        method: "={{ $('Normalizar request').first().json.method }}",
        path: "={{ $('Normalizar request').first().json.path }}",
        userId: "={{ $('Validar auth').first().json.userId || '' }}",
        sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
      },
    },
  }),
  n('Registrar auditoria', 'n8n-nodes-base.executeWorkflow', 1.3, [2240, 0], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: AUDIT },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        requestId: '={{ $json.requestId }}',
        tracking: '={{ $json.tracking }}',
        response: '={{ $json.response }}',
        responseHeaders: '={{ $json.responseHeaders }}',
        headers: "={{ $('Normalizar request').first().json.headers || {} }}",
        action: 'EMBEDDING_REPROCESS_REQUESTED',
        resourceType: 'system',
        resourceId: '',
        success: '={{ $json.tracking?.success !== false }}',
        userId: "={{ $json.tracking?.userId || $('Validar auth').first().json.userId || '' }}",
        sessionId: "={{ $json.tracking?.sessionId || $('Validar auth').first().json.sessionId || '' }}",
        method: "={{ $json.tracking?.method || $('Normalizar request').first().json.method }}",
        path: "={{ $json.tracking?.path || $('Normalizar request').first().json.path }}",
        statusCode: '={{ $json.statusCode }}',
        durationMs: '={{ $json.durationMs }}',
        beforeData: '={{ null }}',
        afterData: '={{ null }}',
        metadata: "={{ { processed: ($('Montar resposta').first().json.data && $('Montar resposta').first().json.data.processed) || 0 } }}",
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  }),
  n('Repassar resposta', 'n8n-nodes-base.code', 2, [2464, 0], {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`,
  }),
  n('Respond to Webhook', 'n8n-nodes-base.respondToWebhook', 1.5, [2688, 0], {
    respondWith: 'json',
    responseBody: '={{ $json.response }}',
    options: { responseCode: '={{ $json.statusCode }}', responseHeaders: respondHeaders },
  }),
  n('Preparar erro 403', 'n8n-nodes-base.executeWorkflow', 1.3, [1344, 192], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        code: "={{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}",
        message: "={{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}",
        requestId: "={{ $('Normalizar request').first().json.requestId }}",
        statusCode: 403,
        requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
        method: "={{ $('Normalizar request').first().json.method }}",
        path: "={{ $('Normalizar request').first().json.path }}",
      },
    },
  }),
  n('Respond 403', 'n8n-nodes-base.respondToWebhook', 1.5, [1568, 192], {
    respondWith: 'json',
    responseBody: '={{ $json.response }}',
    options: { responseCode: 403, responseHeaders: respondHeaders },
  }),
  n('Preparar erro 401', 'n8n-nodes-base.executeWorkflow', 1.3, [896, 288], {
    mode: 'once',
    options: { waitForSubWorkflow: true },
    source: 'database',
    workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        code: "={{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}",
        message: "={{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}",
        requestId: "={{ $('Normalizar request').first().json.requestId }}",
        statusCode: 401,
        requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
        method: "={{ $('Normalizar request').first().json.method }}",
        path: "={{ $('Normalizar request').first().json.path }}",
      },
    },
  }),
  n('Respond 401', 'n8n-nodes-base.respondToWebhook', 1.5, [1120, 288], {
    respondWith: 'json',
    responseBody: '={{ $json.response }}',
    options: { responseCode: 401, responseHeaders: respondHeaders },
  }),
];

const connections = {
  Webhook: { main: [[{ node: 'Normalizar request', type: 'main', index: 0 }]] },
  'Normalizar request': { main: [[{ node: 'Validar auth', type: 'main', index: 0 }]] },
  'Validar auth': { main: [[{ node: 'Auth ok?', type: 'main', index: 0 }]] },
  'Auth ok?': {
    main: [
      [{ node: 'Validar permissão', type: 'main', index: 0 }],
      [{ node: 'Preparar erro 401', type: 'main', index: 0 }],
    ],
  },
  'Validar permissão': { main: [[{ node: 'Permissão ok?', type: 'main', index: 0 }]] },
  'Permissão ok?': {
    main: [
      [{ node: 'Restaurar request', type: 'main', index: 0 }],
      [{ node: 'Preparar erro 403', type: 'main', index: 0 }],
    ],
  },
  'Restaurar request': { main: [[{ node: 'Chamar REPROCESSAR', type: 'main', index: 0 }]] },
  'Chamar REPROCESSAR': { main: [[{ node: 'Montar resposta', type: 'main', index: 0 }]] },
  'Montar resposta': { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] },
  'Preparar sucesso': { main: [[{ node: 'Registrar auditoria', type: 'main', index: 0 }]] },
  'Registrar auditoria': { main: [[{ node: 'Repassar resposta', type: 'main', index: 0 }]] },
  'Repassar resposta': { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] },
  'Preparar erro 403': { main: [[{ node: 'Respond 403', type: 'main', index: 0 }]] },
  'Preparar erro 401': { main: [[{ node: 'Respond 401', type: 'main', index: 0 }]] },
};

const client = new pg.Client({
  connectionString: process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT "activeVersionId" FROM workflow_entity WHERE id = $1`, [WF_ID]);
await client.query(
  `UPDATE workflow_entity SET nodes = $1::json, connections = $2::json, description = $3, "updatedAt" = NOW() WHERE id = $4`,
  [
    JSON.stringify(nodes),
    JSON.stringify(connections),
    'POST /webhook/system/embeddings/reprocess — reprocessa embeddings com auth editar_configuracoes.',
    WF_ID,
  ]
);
if (rows[0]?.activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW() WHERE "workflowId" = $3 AND "versionId" = $4`,
    [JSON.stringify(nodes), JSON.stringify(connections), WF_ID, rows[0].activeVersionId]
  );
}
writeFileSync(new URL('./_webhook-install.json', import.meta.url), JSON.stringify({ id: WF_ID, nodes: nodes.length }, null, 2));
console.log(JSON.stringify({ id: WF_ID, nodes: nodes.length }, null, 2));
await client.end();
