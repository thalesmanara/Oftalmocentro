import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const pgCred = { postgres: newCredential('Postgres account') };

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'documents/versions',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {},
    },
    output: [{ json: { headers: {}, query: { documentId: '00000000-0000-0000-0000-000000000001' }, body: {} } }],
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
    output: [{ json: { requestId: 'req-1', requestStartedAtMs: 1, method: 'GET', path: '/webhook/documents/versions', headers: {}, authorization: 'Bearer x', query: { documentId: '00000000-0000-0000-0000-000000000001' } } }],
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
    output: [{ json: { ok: true, userId: 'u1', sessionId: 's1', user: { id: 'u1', isMaster: true }, permissions: [] } }],
  },
});

const authOk = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
    output: [[{ json: { ok: true } }], [{ json: { ok: false } }]],
  },
});

const validarPerm = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'yXW3rW8EbHXuprRJ', cachedResultName: 'AUTH - VALIDAR PERMISSÃO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          isMaster: expr('{{ $json.user ? $json.user.isMaster === true : false }}'),
          permissions: expr('{{ $json.permissions || ($json.user && $json.user.permissions) || [] }}'),
          requiredAnyOf: expr('{{ [] }}'),
          requiredPermission: 'visualizar_documentos',
          sessionId: expr("{{ $json.sessionId || '' }}"),
          user: expr('{{ $json.user || null }}'),
          userId: expr("{{ $json.userId || ($json.user && $json.user.id) || '' }}"),
          requestId: expr("{{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { ok: true } }],
  },
});

const permOk = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
    output: [[{ json: { ok: true } }], [{ json: { ok: false } }]],
  },
});

const restaurar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "return [$('Normalizar request').first()];",
    },
    output: [{ json: { query: { documentId: '00000000-0000-0000-0000-000000000001' }, requestId: 'req-1' } }],
  },
});

const buscar = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar versões',
    credentials: pgCred,
    parameters: {
      operation: 'executeQuery',
      query:
        "SELECT\n" +
        "  dv.id,\n" +
        "  dv.document_id AS \"documentId\",\n" +
        "  dv.version_number AS \"versionNumber\",\n" +
        "  dv.is_current AS \"isCurrent\",\n" +
        "  dv.status,\n" +
        "  dv.file_name AS \"fileName\",\n" +
        "  dv.file_size AS \"fileSize\",\n" +
        "  dv.mime_type AS \"mimeType\",\n" +
        "  dv.title_snapshot AS \"titleSnapshot\",\n" +
        "  dv.description_snapshot AS \"descriptionSnapshot\",\n" +
        "  dv.expiration_date AS \"expirationDate\",\n" +
        "  dv.processing_status AS \"processingStatus\",\n" +
        "  dv.created_by AS \"createdBy\",\n" +
        "  u.name AS \"createdByName\",\n" +
        "  dv.created_at AS \"createdAt\",\n" +
        "  LEFT(dv.checksum, 12) AS \"checksum\"\n" +
        "FROM document_versions dv\n" +
        "LEFT JOIN users u ON u.id = dv.created_by\n" +
        "JOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL\n" +
        "WHERE dv.document_id = '{{ $json.query.documentId }}'::uuid\n" +
        "ORDER BY dv.version_number DESC;",
      options: {},
    },
    output: [{ json: { id: 'v1', documentId: 'd1', versionNumber: 1, isCurrent: true, status: 'CURRENT', createdAt: '2026-01-01' } }],
  },
});

const montar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar data',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const items = $input.all().map((i) => i.json).filter((j) => j && j.id);\n" +
        "const norm = $('Normalizar request').first().json;\n" +
        "let userId = ''; let sessionId = '';\n" +
        "try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}\n" +
        "return [{ json: { data: items, asList: true, statusCode: 200, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path, userId, sessionId } }];",
    },
    output: [{ json: { data: [], asList: true, statusCode: 200, requestId: 'req-1' } }],
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
          asList: expr('{{ $json.asList }}'),
          data: expr('{{ $json.data }}'),
          requestId: expr("{{ $json.requestId || $('Normalizar request').first().json.requestId }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: true, data: [] }, statusCode: 200, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
  },
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
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
    output: [{ json: {} }],
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
    output: [{ json: { response: { success: false }, statusCode: 401, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
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
    output: [{ json: {} }],
  },
});

const err403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'FORBIDDEN',
          message: 'Você não possui permissão para executar esta ação.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 403,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { response: { success: false }, statusCode: 403, requestId: 'req-1', durationMs: 1, responseHeaders: {} } }],
  },
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 403,
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr('{{ $json.requestId || "" }}') },
            { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs || 0) }}') },
          ],
        },
      },
    },
    output: [{ json: {} }],
  },
});

export default workflow('get-document-versions', 'GET Document Versions')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(
    authOk
      .onTrue(
        validarPerm.to(
          permOk
            .onTrue(restaurar.to(buscar.to(montar.to(sucesso.to(respond)))))
            .onFalse(err403.to(respond403))
        )
      )
      .onFalse(err401.to(respond401))
  );
