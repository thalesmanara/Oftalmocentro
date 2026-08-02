import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const montarAdminJs = `const health = $input.first().json || {};
const norm = $('Normalizar request').first().json;
let userId = ''; let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
const comps = health.components || {};
const allowedCompKeys = ['n8n','database','storage','tika','configuration','sessions','audit','documents'];
const components = {};
for (const key of allowedCompKeys) {
  if (!comps[key]) continue;
  const c = comps[key];
  const out = { status: c.status || 'unknown' };
  if (typeof c.durationMs === 'number') out.durationMs = c.durationMs;
  if (key === 'storage' && typeof c.storageAvailable === 'boolean') out.storageAvailable = c.storageAvailable;
  if (key === 'sessions' && typeof c.activeCount === 'number') out.activeCount = c.activeCount;
  if (key === 'configuration' && c.openai) out.openai = c.openai;
  if (key === 'documents') {
    for (const f of ['total','processing','errors','missingFiles','processedWithoutChunks']) {
      if (typeof c[f] === 'number') out[f] = c[f];
    }
  }
  components[key] = out;
}
return [{ json: {
  data: { status: health.status || 'down', checkedAt: health.checkedAt || new Date().toISOString(), components },
  asList: false,
  statusCode: health.httpStatus === 503 ? 503 : 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
}}];`;

const repassarJs = `const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`;

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/health', responseMode: 'responseNode', options: {} },
  },
});

const normalizar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - NORMALIZAR REQUEST', mode: 'id', value: 'N3zLpj7Dij4n5p5p' },
    },
  },
});

const validarAuth = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar auth',
    parameters: {
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
    },
  },
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'a1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const validarPerm = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    parameters: {
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
    },
  },
});

const permOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        conditions: [{ id: 'p1', leftValue: '={{ $json.ok }}', operator: { operation: 'true', type: 'boolean' }, rightValue: true }],
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      },
      looseTypeValidation: true,
    },
  },
});

const restaurar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: restoreJs },
  },
});

const executarHealthCheck = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Executar health check',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - HEALTH CHECK', mode: 'id', value: '2z5ArPfeh7CMVWJb' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { mode: 'detailed' },
      },
    },
  },
});

const montarAdmin = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta admin',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: montarAdminJs },
  },
});

const prepararSucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso',
    parameters: {
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
    },
  },
});

const registrarAuditoria = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria',
    settings: { onError: 'continueRegularOutput', alwaysOutputData: true },
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: '={{ $json.requestId }}',
          tracking: '={{ $json.tracking }}',
          response: '={{ $json.response }}',
          responseHeaders: '={{ $json.responseHeaders }}',
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          action: 'SYSTEM_HEALTH_CHECK',
          resourceType: 'system',
          resourceId: "={{ '' }}",
          success: '={{ $json.tracking?.success !== false }}',
          userId: "={{ $json.tracking?.userId || $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $json.tracking?.sessionId || $('Validar auth').first().json.sessionId || '' }}",
          method: "={{ $json.tracking?.method || $('Normalizar request').first().json.method }}",
          path: "={{ $json.tracking?.path || $('Normalizar request').first().json.path }}",
          statusCode: '={{ $json.statusCode }}',
          durationMs: '={{ $json.durationMs }}',
          errorCode: '={{ $json.tracking?.errorCode || ($json.response?.error?.code ?? null) }}',
          beforeData: '={{ null }}',
          afterData: '={{ null }}',
          metadata: "={{ { status: ($('Montar resposta admin').first().json.data && $('Montar resposta admin').first().json.data.status) ? $('Montar resposta admin').first().json.data.status : 'unknown' } }}",
        },
      },
    },
  },
});

const repassarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Repassar resposta',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: repassarJs },
  },
});

const preparar401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    parameters: {
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
    },
  },
});

const preparar403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    parameters: {
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
    },
  },
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: '={{ $json.statusCode }}', responseHeaders: respondHeaders },
    },
  },
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 401, responseHeaders: respondHeaders },
    },
  },
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 403, responseHeaders: respondHeaders },
    },
  },
});

const successPath = restaurar
  .to(executarHealthCheck)
  .to(montarAdmin)
  .to(prepararSucesso)
  .to(registrarAuditoria)
  .to(repassarResposta)
  .to(respondOk);

export default workflow('get-system-health', 'GET System Health')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
