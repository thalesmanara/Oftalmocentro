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
    parameters: { path: 'system/ai-prompts/publish', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
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
const versionId = String(body.versionId || '').trim();
if (!versionId) {
  return [{ json: { ok: false, httpStatus: 400, code: 'VERSION_ID_REQUIRED', message: 'versionId é obrigatório.' } }];
}
return [{ json: {
  ok: true,
  promptVersionId: versionId,
  userId,
  requestId: norm.requestId || '',
  forceOverride: !!body.forceOverride,
  overrideReason: String(body.overrideReason || '').trim(),
  validationRunId: String(body.validationRunId || '').trim(),
} }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886' } }],
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

const chamarPublicar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Chamar PUBLICAR',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'L8FL9uMkcqiVpskV', cachedResultName: 'IA - PUBLICAR PROMPT' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          promptVersionId: '={{ $json.promptVersionId }}',
          userId: '={{ $json.userId }}',
          requestId: '={{ $json.requestId }}',
          forceOverride: '={{ $json.forceOverride }}',
          overrideReason: '={{ $json.overrideReason }}',
          validationRunId: '={{ $json.validationRunId }}',
        },
      },
    },
  },
  output: [{ json: { ok: true, promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886', versionNumber: 2, status: 'PUBLISHED', overrideUsed: false, promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d', promptCode: 'AI_QUERY_MAIN', contentHash: 'h', modelName: 'gpt-4.1-mini' } }],
});

const avaliarPublicacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar publicação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const pub = $input.first().json || {};
const norm = $('Normalizar request').first().json || {};
let sessionId = '';
try { sessionId = $('Validar auth').first().json.sessionId || ''; } catch (e) {}
if (!pub.ok) {
  return [{ json: {
    ok: false,
    httpStatus: 400,
    code: pub.code || 'PUBLISH_FAILED',
    message: pub.message || 'Falha ao publicar prompt.',
  } }];
}
const version = {
  id: pub.promptVersionId,
  promptDefinitionId: pub.promptDefinitionId,
  promptCode: pub.promptCode,
  purpose: pub.purpose,
  versionNumber: pub.versionNumber != null ? Number(pub.versionNumber) : null,
  status: pub.status,
  environment: pub.environment,
  contentHash: pub.contentHash,
  publishedAt: pub.publishedAt,
  modelName: pub.modelName,
  validationRunId: pub.validationRunId || null,
};
const definition = {
  id: pub.promptDefinitionId,
  code: pub.promptCode,
  purpose: pub.purpose,
};
return [{ json: {
  ok: true,
  data: { definition, version },
  asList: false,
  statusCode: 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId: '',
  sessionId,
  auditVersionId: version.id,
  auditVersionNumber: version.versionNumber,
  auditModelName: version.modelName,
  auditContentHash: version.contentHash,
  auditPromptDefinitionId: version.promptDefinitionId,
  auditPromptCode: version.promptCode,
  auditOverrideUsed: !!pub.overrideUsed,
  auditOverrideReason: pub.overrideReason || null,
  auditValidationRunId: version.validationRunId,
} }];`,
    },
  },
  output: [{ json: { ok: true, data: {}, asList: false, statusCode: 200, requestId: '11111111-1111-1111-1111-111111111111', auditOverrideUsed: false } }],
});

const publicacaoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Publicação ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'p1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
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
    name: 'Auditar publicação',
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
          action: "={{ $('Avaliar publicação').first().json.auditOverrideUsed ? 'AI_PROMPT_PUBLISH_OVERRIDE' : 'AI_PROMPT_PUBLISH' }}",
          resourceType: 'ai_prompt_version',
          resourceId: "={{ $('Avaliar publicação').first().json.auditVersionId || '' }}",
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
            "={{ { promptDefinitionId: $('Avaliar publicação').first().json.auditPromptDefinitionId, promptCode: $('Avaliar publicação').first().json.auditPromptCode, versionNumber: $('Avaliar publicação').first().json.auditVersionNumber, modelName: $('Avaliar publicação').first().json.auditModelName, contentHash: $('Avaliar publicação').first().json.auditContentHash, validationRunId: $('Avaliar publicação').first().json.auditValidationRunId, overrideReason: $('Avaliar publicação').first().json.auditOverrideReason } }}",
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
      .onTrue(chamarPublicar.to(avaliarPublicacao.to(publicacaoOk.onTrue(prepararSucesso.to(auditar.to(repassarResposta.to(respondDynamic)))).onFalse(prepararErroNegocio.to(respondErroNegocio)))))
      .onFalse(prepararErroNegocio.to(respondErroNegocio))
  )
);

export default workflow('post-ai-prompts-publish', 'POST System AI Prompts Publish')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
