import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const montarPublicJs = `const health = $input.first().json || {};
const norm = $('Normalizar request').first().json;
return [{ json: {
  data: {
    status: health.status === 'down' ? 'down' : (health.status === 'degraded' ? 'degraded' : 'ok'),
    service: 'oftalmocentro-inteligente',
    timestamp: health.checkedAt || new Date().toISOString()
  },
  asList: false,
  statusCode: health.httpStatus === 503 ? 503 : 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path
} }];`;

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'health', responseMode: 'responseNode', options: {} },
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
        value: { mode: 'public' },
      },
    },
  },
});

const montarPublica = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta pública',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: montarPublicJs },
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

export default workflow('get-health', 'GET Health')
  .add(webhook)
  .to(normalizar)
  .to(executarHealthCheck)
  .to(montarPublica)
  .to(prepararSucesso)
  .to(respondOk);
