import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/ai-prompts/rollback', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
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

const prepararInputs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar inputs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
let userId = '';
try { userId = $('Validar auth').first().json.userId || ''; } catch (e) {}
const targetVersionId = String(body.targetVersionId || '').trim();
const reason = String(body.reason || '').trim();
if (!targetVersionId) {
  return [{ json: { ok: false, httpStatus: 400, code: 'TARGET_VERSION_REQUIRED', message: 'targetVersionId é obrigatório.' } }];
}
if (!reason) {
  return [{ json: { ok: false, httpStatus: 400, code: 'REASON_REQUIRED', message: 'reason é obrigatório para rollback.' } }];
}
return [{ json: {
  ok: true,
  promptDefinitionId: String(body.promptDefinitionId || '').trim(),
  purpose: String(body.purpose || 'AI_QUERY_MAIN').trim() || 'AI_QUERY_MAIN',
  code: String(body.code || 'AI_QUERY_MAIN').trim() || 'AI_QUERY_MAIN',
  targetVersionId,
  userId,
  requestId: norm.requestId || '',
  reason,
} }];`,
    },
  },
  output: [{ json: { ok: true, targetVersionId: 'a23741ae-2cef-46c6-8690-f603fc3fe569', reason: 'test' } }],
});

const inputsOk = ifElse({
  version: 2.3,
  config: {
    name: 'Inputs ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'i1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const chamarRollback = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Chamar ROLLBACK',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'dziymkwKvfYJmBUp', cachedResultName: 'IA - ROLLBACK DE PROMPT' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          promptDefinitionId: '={{ $json.promptDefinitionId }}',
          purpose: '={{ $json.purpose }}',
          code: '={{ $json.code }}',
          targetVersionId: '={{ $json.targetVersionId }}',
          userId: '={{ $json.userId }}',
          requestId: '={{ $json.requestId }}',
          reason: '={{ $json.reason }}',
        },
      },
    },
  },
  output: [{ json: { ok: true, promptVersionId: 'new', versionNumber: 3, status: 'PUBLISHED', promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d', promptCode: 'AI_QUERY_MAIN', contentHash: 'h', modelName: 'gpt-4.1-mini' } }],
});

const avaliarRollback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar rollback',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const rb = $input.first().json || {};
const prep = $('Preparar inputs').first().json || {};
const norm = $('Normalizar request').first().json || {};
let sessionId = '';
try { sessionId = $('Validar auth').first().json.sessionId || ''; } catch (e) {}
if (!rb.ok) {
  return [{ json: {
    ok: false,
    httpStatus: 400,
    code: rb.code || 'ROLLBACK_FAILED',
    message: rb.message || 'Falha ao executar rollback.',
  } }];
}
return [{ json: {
  ok: true,
  data: {
    ok: true,
    promptVersionId: rb.promptVersionId,
    promptDefinitionId: rb.promptDefinitionId,
    promptCode: rb.promptCode,
    purpose: rb.purpose,
    versionNumber: rb.versionNumber != null ? Number(rb.versionNumber) : null,
    status: rb.status,
    environment: rb.environment,
    contentHash: rb.contentHash,
    publishedAt: rb.publishedAt,
    modelName: rb.modelName,
    basedOnVersionId: rb.basedOnVersionId,
    rolledBackFromPublishedId: rb.rolledBackFromPublishedId || null,
  },
  asList: false,
  statusCode: 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId: '',
  sessionId,
  auditVersionId: rb.promptVersionId,
  auditVersionNumber: rb.versionNumber,
  auditModelName: rb.modelName,
  auditContentHash: rb.contentHash,
  auditPromptDefinitionId: rb.promptDefinitionId,
  auditPromptCode: rb.promptCode,
  auditReason: prep.reason,
  auditTargetVersionId: prep.targetVersionId,
} }];`,
    },
  },
  output: [{ json: { ok: true, data: {}, asList: false, statusCode: 200, requestId: '11111111-1111-1111-1111-111111111111' } }],
});

const rollbackOk = ifElse({
  version: 2.3,
  config: {
    name: 'Rollback ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'r1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
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

const auditar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar rollback',
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
          action: 'AI_PROMPT_ROLLBACK',
          resourceType: 'ai_prompt_version',
          resourceId: "={{ $('Avaliar rollback').first().json.auditVersionId || '' }}",
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
            "={{ { promptDefinitionId: $('Avaliar rollback').first().json.auditPromptDefinitionId, promptCode: $('Avaliar rollback').first().json.auditPromptCode, versionNumber: $('Avaliar rollback').first().json.auditVersionNumber, modelName: $('Avaliar rollback').first().json.auditModelName, contentHash: $('Avaliar rollback').first().json.auditContentHash, targetVersionId: $('Avaliar rollback').first().json.auditTargetVersionId, reason: $('Avaliar rollback').first().json.auditReason } }}",
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
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`,
    },
  },
});

const prepararErroNegocio = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro negócio',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: '={{ $json.code }}',
          message: '={{ $json.message }}',
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: '={{ $json.httpStatus }}',
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
        },
      },
    },
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

const respondDynamic = node({
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

const respondErroNegocio = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond erro negócio',
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

const successPath = restaurar.to(
  prepararInputs.to(
    inputsOk
      .onTrue(chamarRollback.to(avaliarRollback.to(rollbackOk.onTrue(prepararSucesso.to(auditar.to(repassarResposta.to(respondDynamic)))).onFalse(prepararErroNegocio.to(respondErroNegocio)))))
      .onFalse(prepararErroNegocio.to(respondErroNegocio))
  )
);

export default workflow('post-ai-prompts-rollback', 'POST System AI Prompts Rollback')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
