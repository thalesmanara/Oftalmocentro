import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const montarRespostaJs = `const norm = $('Normalizar request').first().json;
const dataset = $input.first().json || {};
const run = dataset.run || null;
const metrics = dataset.metrics || null;
const results = dataset.results || [];
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: { run, metrics, results },
  asList: false,
  statusCode: run ? 200 : 500,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
  runId: run ? run.id : null,
  runStatus: run ? run.status : 'FAILED',
  metricsTotalCount: metrics ? metrics.totalCount : null,
  metricsOverallScore: metrics ? metrics.overallScore : null,
  metricsPrecision: metrics ? metrics.precision : null,
  metricsRecall: metrics ? metrics.recall : null,
} }];`;

const repassarJs = `const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`;

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/ai-eval/run-dataset', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
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

const auditarInicio = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar início',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DATASET_STARTED',
          resourceType: 'ai_test_run',
          resourceId: "={{ '' }}",
          success: '={{ true }}',
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          metadata:
            "={{ { groupName: ($('Webhook').first().json.body || {}).groupName || null, includeMissingDocs: !!($('Webhook').first().json.body || {}).includeMissingDocs, triggerMode: 'dataset' } }}",
        },
      },
    },
  },
});

const executarDataset = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Executar dataset',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'IA - EXECUTAR DATASET', mode: 'id', value: '12t0Ol6zWQJgAKPC' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          authorization: "={{ $('Normalizar request').first().json.authorization || $('Normalizar request').first().json.headers.authorization || $('Normalizar request').first().json.headers.Authorization || '' }}",
          triggeredBy: "={{ $('Validar auth').first().json.userId || '' }}",
          groupName: "={{ ($('Webhook').first().json.body || {}).groupName || '' }}",
          includeMissingDocs: "={{ !!($('Webhook').first().json.body || {}).includeMissingDocs }}",
          caseId: '',
          caseCode: '',
          triggerMode: 'dataset',
        },
      },
    },
  },
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta admin',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: montarRespostaJs },
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

const auditarFim = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar fim',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DATASET_FINISHED',
          resourceType: 'ai_test_run',
          resourceId: "={{ $('Montar resposta admin').first().json.runId || '' }}",
          success: "={{ $('Montar resposta admin').first().json.runStatus !== 'FAILED' }}",
          requestId: '={{ $json.requestId }}',
          tracking: '={{ $json.tracking }}',
          response: '={{ $json.response }}',
          responseHeaders: '={{ $json.responseHeaders }}',
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          statusCode: '={{ $json.statusCode }}',
          durationMs: '={{ $json.durationMs }}',
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          metadata:
            "={{ { runId: $('Montar resposta admin').first().json.runId, status: $('Montar resposta admin').first().json.runStatus, totalCount: $('Montar resposta admin').first().json.metricsTotalCount, overallScore: $('Montar resposta admin').first().json.metricsOverallScore } }}",
        },
      },
    },
  },
});

const auditarMetricas = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar métricas',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'METRICS_GENERATED',
          resourceType: 'ai_test_metrics',
          resourceId: "={{ $('Montar resposta admin').first().json.runId || '' }}",
          success: '={{ true }}',
          requestId: '={{ $json.requestId }}',
          tracking: '={{ $json.tracking }}',
          response: '={{ $json.response }}',
          responseHeaders: '={{ $json.responseHeaders }}',
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          statusCode: '={{ $json.statusCode }}',
          durationMs: '={{ $json.durationMs }}',
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          metadata:
            "={{ { runId: $('Montar resposta admin').first().json.runId, totalCount: $('Montar resposta admin').first().json.metricsTotalCount, overallScore: $('Montar resposta admin').first().json.metricsOverallScore, precision: $('Montar resposta admin').first().json.metricsPrecision, recall: $('Montar resposta admin').first().json.metricsRecall } }}",
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
  .to(auditarInicio)
  .to(executarDataset)
  .to(montarResposta)
  .to(prepararSucesso)
  .to(auditarFim)
  .to(auditarMetricas)
  .to(repassarResposta)
  .to(respondOk);

export default workflow('post-system-ai-eval-run-dataset', 'POST System AI Eval Run Dataset')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
