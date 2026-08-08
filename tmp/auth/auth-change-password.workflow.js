import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const pgCred = { postgres: newCredential('Postgres account') };

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'auth/change-password',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {},
    },
    output: [{
      json: {
        headers: { authorization: 'Bearer x' },
        body: { currentPassword: 'old-pass', newPassword: 'new-pass-12', confirmPassword: 'new-pass-12' },
      },
    }],
  },
});

const normalizar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'N3zLpj7Dij4n5p5p', cachedResultName: 'SYSTEM - NORMALIZAR REQUEST' },
      mode: 'once',
      options: { waitForSubWorkflow: true },
    },
    output: [{
      json: {
        requestId: 'req-1',
        requestStartedAtMs: 1,
        method: 'POST',
        path: '/webhook/auth/change-password',
        headers: { authorization: 'Bearer x' },
        authorization: 'Bearer x',
        body: { currentPassword: 'old-pass', newPassword: 'new-pass-12', confirmPassword: 'new-pass-12' },
      },
    }],
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
          authorization: expr("{{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}"),
          requestId: expr("{{ $json.requestId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { ok: true, userId: '00000000-0000-0000-0000-000000000001', sessionId: 's1', user: { id: '00000000-0000-0000-0000-000000000001' } } }],
  },
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'auth-ok', leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
    output: [[{ json: { ok: true, userId: 'u1' } }], [{ json: { ok: false } }]],
  },
});

const validarPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar payload',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const norm = $('Normalizar request').first().json;\n" +
        "const auth = $('Validar auth').first().json;\n" +
        "const body = norm.body || {};\n" +
        "const currentPassword = String(body.currentPassword || '');\n" +
        "const newPassword = String(body.newPassword || '');\n" +
        "const confirmPassword = String(body.confirmPassword != null ? body.confirmPassword : newPassword);\n" +
        "const userId = String(auth.userId || (auth.user && auth.user.id) || '');\n" +
        "function fail(code, message) {\n" +
        "  return [{ json: { ok: false, code, message, userId, sessionId: String(auth.sessionId || ''), currentPassword: '', newPassword: '' } }];\n" +
        "}\n" +
        "if (!userId) return fail('UNAUTHORIZED', 'Autenticação obrigatória.');\n" +
        "if (!currentPassword) return fail('VALIDATION_ERROR', 'Informe a senha atual.');\n" +
        "if (!newPassword) return fail('VALIDATION_ERROR', 'Informe a nova senha.');\n" +
        "if (newPassword.length < 8) return fail('VALIDATION_ERROR', 'A nova senha deve ter pelo menos 8 caracteres.');\n" +
        "if (confirmPassword !== newPassword) return fail('VALIDATION_ERROR', 'A confirmação da nova senha não confere.');\n" +
        "if (newPassword === currentPassword) return fail('VALIDATION_ERROR', 'A nova senha deve ser diferente da senha atual.');\n" +
        "return [{ json: { ok: true, userId, sessionId: String(auth.sessionId || ''), currentPassword, newPassword } }];",
    },
    output: [{ json: { ok: true, userId: 'u1', sessionId: 's1', currentPassword: 'old', newPassword: 'new-pass-12' } }],
  },
});

const payloadOk = ifElse({
  version: 2.3,
  config: {
    name: 'Payload ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'payload-ok', leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
    output: [[{ json: { ok: true, userId: 'u1' } }], [{ json: { ok: false, code: 'VALIDATION_ERROR', message: 'x' } }]],
  },
});

const atualizarSenha = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar senha',
    credentials: pgCred,
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      query:
        "UPDATE users\n" +
        "SET\n" +
        "  password_hash = crypt(\n" +
        "    '{{ String($json.newPassword || \"\").replace(/'/g, \"''\") }}',\n" +
        "    gen_salt('bf', 10)\n" +
        "  ),\n" +
        "  updated_at = NOW()\n" +
        "WHERE id = '{{ $json.userId }}'::uuid\n" +
        "  AND active = TRUE\n" +
        "  AND (\n" +
        "    (\n" +
        "      (\n" +
        "        password_hash LIKE '$2a$%'\n" +
        "        OR password_hash LIKE '$2b$%'\n" +
        "        OR password_hash LIKE '$2y$%'\n" +
        "      )\n" +
        "      AND password_hash = crypt(\n" +
        "        '{{ String($json.currentPassword || \"\").replace(/'/g, \"''\") }}',\n" +
        "        password_hash\n" +
        "      )\n" +
        "    )\n" +
        "    OR (\n" +
        "      password_hash NOT LIKE '$2a$%'\n" +
        "      AND password_hash NOT LIKE '$2b$%'\n" +
        "      AND password_hash NOT LIKE '$2y$%'\n" +
        "      AND password_hash = '{{ String($json.currentPassword || \"\").replace(/'/g, \"''\") }}'\n" +
        "    )\n" +
        "  )\n" +
        "RETURNING id, email, updated_at AS \"updatedAt\";",
      options: {},
    },
    output: [{ json: { id: 'u1', email: 'a@b.com', updatedAt: '2026-01-01' } }],
  },
});

const senhaOk = ifElse({
  version: 2.3,
  config: {
    name: 'Senha atualizada?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'pwd-ok', leftValue: expr('{{ $json.id }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' }],
      },
      looseTypeValidation: true,
    },
    output: [[{ json: { id: 'u1', email: 'a@b.com' } }], [{ json: {} }]],
  },
});

const sucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'zE5LRjZfbXw8Ymll', cachedResultName: 'SYSTEM - PREPARAR SUCESSO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          data: expr('{{ ({ changed: true, userId: $json.id, email: $json.email }) }}'),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 200,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: true, data: { changed: true } }, statusCode: 200, requestId: 'req-1', durationMs: 1, responseHeaders: {}, tracking: {} } }],
  },
});

const auditOk = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria sucesso',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'AUTH_CHANGE_PASSWORD',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: '',
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $json.tracking && $json.tracking.method ? $json.tracking.method : ($('Normalizar request').first().json.method || '') }}"),
          path: expr("{{ $json.tracking && $json.tracking.path ? $json.tracking.path : ($('Normalizar request').first().json.path || '') }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
          resourceType: 'user',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: true,
          tracking: expr('{{ $json.tracking }}'),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: true }, statusCode: 200, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
  },
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: expr('{{ $json.statusCode }}'),
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr('{{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}') },
            { name: 'X-Response-Time-Ms', value: expr('{{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}') },
          ],
        },
      },
    },
  },
});

const err401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'UNAUTHORIZED',
          message: 'Autenticação obrigatória.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 401,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: false }, statusCode: 401, requestId: 'req-1', durationMs: 1, responseHeaders: {}, tracking: {} } }],
  },
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 401,
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr('{{ $json.requestId || "" }}') },
            { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs || 0) }}') },
          ],
        },
      },
    },
  },
});

const err400 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 400',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr("{{ $json.code || 'VALIDATION_ERROR' }}"),
          message: expr("{{ $json.message || 'Dados inválidos.' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 400,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: false }, statusCode: 400, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
  },
});

const respond400 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 400',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 400,
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr('{{ $json.requestId || "" }}') },
            { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs || 0) }}') },
          ],
        },
      },
    },
  },
});

const errCurrent = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro senha atual',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'INVALID_CREDENTIALS',
          message: 'Senha atual incorreta.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 400,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: false }, statusCode: 400, requestId: 'req-1', durationMs: 1, responseHeaders: {}, tracking: {} } }],
  },
});

const auditFail = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria falha senha',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'AUTH_CHANGE_PASSWORD',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: 'INVALID_CREDENTIALS',
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
          resourceType: 'user',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          tracking: expr('{{ $json.tracking }}'),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: false }, statusCode: 400, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
  },
});

const respondCurrent = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond senha atual',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 400,
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr('{{ $json.requestId || "" }}') },
            { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs || 0) }}') },
          ],
        },
      },
    },
  },
});

export default workflow('auth-change-password', 'AUTH - CHANGE PASSWORD')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk
    .onTrue(
      validarPayload.to(
        payloadOk
          .onTrue(
            atualizarSenha.to(
              senhaOk
                .onTrue(sucesso.to(auditOk.to(respondOk)))
                .onFalse(errCurrent.to(auditFail.to(respondCurrent)))
            )
          )
          .onFalse(err400.to(respond400))
      )
    )
    .onFalse(err401.to(respond401))
  );
