import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: {
      httpMethod: 'GET',
      path: 'documents/tabular/preview',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {},
    },
  },
  output: [{ query: { documentId: 'd1', versionId: 'v1' }, headers: {} }],
});

const normalizarRequest = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    position: [224, 192],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'N3zLpj7Dij4n5p5p', cachedResultName: 'SYSTEM - NORMALIZAR REQUEST' },
      mode: 'once',
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ requestId: 'r1', method: 'GET', path: '/documents/tabular/preview', requestStartedAtMs: 0, query: { documentId: 'd1', versionId: 'v1' }, headers: {}, authorization: '' }],
});

const validarAuth = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar auth',
    position: [448, 192],
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
  },
  output: [{ ok: true, userId: 'u1', sessionId: 's1', user: { id: 'u1', isMaster: false, permissions: [] } }],
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    position: [672, 192],
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
  },
});

const validarPermissao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    position: [896, 96],
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
  },
  output: [{ ok: true }],
});

const permissaoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    position: [1120, 96],
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
  },
});

const validarParametros = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar parâmetros',
    position: [1344, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const norm = $('Normalizar request').first().json || {};\nconst query = norm.query || {};\nconst documentId = String(query.documentId || '').trim();\nconst versionId = String(query.versionId || '').trim();\nconst uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;\nconst paramsValid = uuidRe.test(documentId) && uuidRe.test(versionId);\nreturn [{ json: { documentId, versionId, paramsValid } }];`,
    },
  },
  output: [{ documentId: 'd1', versionId: 'v1', paramsValid: true }],
});

const parametrosValidos = ifElse({
  version: 2.3,
  config: {
    name: 'Parâmetros válidos?',
    position: [1568, 0],
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.paramsValid }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
  },
});

const buscarVersaoTabular = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar versão tabular',
    position: [1792, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=SELECT\n  dv.id AS "versionId",\n  dv.document_id AS "documentId",\n  dv.version_number AS "versionNumber",\n  dv.sheet_count AS "sheetCount",\n  dv.table_row_count AS "tableRowCount",\n  dv.table_column_count AS "tableColumnCount",\n  dv.table_summary AS "summary",\n  dv.table_preview AS "tablePreview",\n  dv.extraction_method AS "extractionMethod",\n  COALESCE(dv.title_snapshot, d.title) AS "documentTitle"\nFROM document_versions dv\nJOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL\nWHERE dv.id = '{{ $json.versionId }}'::uuid\n  AND dv.document_id = '{{ $json.documentId }}'::uuid;`,
    },
    alwaysOutputData: true,
  },
  output: [{ versionId: 'v1', documentId: 'd1', versionNumber: 1, sheetCount: 2, tableRowCount: 20, tableColumnCount: 5, summary: {}, tablePreview: {}, extractionMethod: 'tabular', documentTitle: 'Doc' }],
});

const avaliarVersaoTabular = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar versão tabular',
    position: [2012, -140],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const rows = $input.all().map((i) => i.json);\nconst row = rows[0] || null;\nreturn [{ json: { found: !!row, ...(row || {}) } }];`,
    },
  },
  output: [{ found: true, versionId: 'v1', documentId: 'd1', versionNumber: 1, sheetCount: 2, tableRowCount: 20, tableColumnCount: 5, summary: {}, tablePreview: {}, extractionMethod: 'tabular', documentTitle: 'Doc' }],
});

const versaoEncontrada = ifElse({
  version: 2.3,
  config: {
    name: 'Versão encontrada?',
    position: [2232, -140],
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.found }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
  },
});

const buscarAbas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar abas',
    position: [2452, -280],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=SELECT\n  id,\n  sheet_index AS "sheetIndex",\n  sheet_name AS "sheetName",\n  row_count AS "rowCount",\n  column_count AS "columnCount",\n  headers,\n  has_merged_cells AS "hasMergedCells"\nFROM document_sheets\nWHERE document_version_id = '{{ $('Avaliar versão tabular').first().json.versionId }}'::uuid\nORDER BY sheet_index ASC;`,
    },
    alwaysOutputData: true,
  },
  output: [{ id: 'sheet-1', sheetIndex: 0, sheetName: 'Sheet1', rowCount: 10, columnCount: 5, headers: [], hasMergedCells: false }],
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta',
    position: [2672, -280],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ver = $('Avaliar versão tabular').first().json || {};\nconst sheets = $input.all().map((i) => i.json);\nconst norm = $('Normalizar request').first().json;\nlet userId = ''; let sessionId = '';\ntry { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}\nconst data = {\n  documentId: ver.documentId,\n  versionId: ver.versionId,\n  versionNumber: ver.versionNumber,\n  documentTitle: ver.documentTitle || null,\n  extractionMethod: ver.extractionMethod || null,\n  sheetCount: ver.sheetCount != null ? Number(ver.sheetCount) : 0,\n  tableRowCount: ver.tableRowCount != null ? Number(ver.tableRowCount) : 0,\n  tableColumnCount: ver.tableColumnCount != null ? Number(ver.tableColumnCount) : 0,\n  summary: ver.summary || null,\n  tablePreview: ver.tablePreview || null,\n  sheets: sheets.map((s) => ({\n    id: s.id,\n    sheetIndex: s.sheetIndex,\n    sheetName: s.sheetName,\n    rowCount: s.rowCount,\n    columnCount: s.columnCount,\n    headers: s.headers,\n    hasMergedCells: s.hasMergedCells,\n  })),\n};\nreturn [{ json: { data, asList: false, statusCode: 200, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path, userId, sessionId } }];`,
    },
  },
  output: [{ data: {}, asList: false, statusCode: 200, requestId: 'r1', requestStartedAtMs: 0, method: 'GET', path: '/documents/tabular/preview', userId: 'u1', sessionId: 's1' }],
});

const prepararSucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso',
    position: [2892, -280],
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
  },
  output: [{ response: { success: true, data: {} }, statusCode: 200, requestId: 'r1', durationMs: 5 }],
});

const respondToWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    position: [3112, -280],
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

const prepararErro401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    position: [896, 288],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr("{{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}"),
          message: expr("{{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 401,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' } }, statusCode: 401, requestId: 'r1' }],
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    position: [1120, 288],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 401,
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

const prepararErro403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    position: [1344, 192],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr("{{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}"),
          message: expr("{{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 403,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ response: { success: false, error: { code: 'FORBIDDEN', message: 'Você não possui permissão para executar esta ação.' } }, statusCode: 403, requestId: 'r1' }],
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    position: [1568, 192],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 403,
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

const prepararErro400 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 400',
    position: [1792, 140],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'INVALID_PARAMETERS',
          message: 'Parâmetros documentId e versionId são obrigatórios e devem ser UUIDs válidos.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 400,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ response: { success: false, error: { code: 'INVALID_PARAMETERS', message: 'Parâmetros inválidos.' } }, statusCode: 400, requestId: 'r1' }],
});

const respond400 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 400',
    position: [2012, 140],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 400,
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

const prepararErro404 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 404',
    position: [2452, 60],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'DOCUMENT_VERSION_NOT_FOUND',
          message: 'Versão de documento não encontrada.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 404,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ response: { success: false, error: { code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Versão de documento não encontrada.' } }, statusCode: 404, requestId: 'r1' }],
});

const respond404 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 404',
    position: [2672, 60],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 404,
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

export default workflow('documents-tabular-preview', 'GET Documents Tabular Preview')
  .add(webhookTrigger)
  .to(normalizarRequest)
  .to(validarAuth)
  .to(authOk
    .onTrue(validarPermissao
      .to(permissaoOk
        .onTrue(validarParametros
          .to(parametrosValidos
            .onTrue(buscarVersaoTabular
              .to(avaliarVersaoTabular)
              .to(versaoEncontrada
                .onTrue(buscarAbas
                  .to(montarResposta)
                  .to(prepararSucesso)
                  .to(respondToWebhook))
                .onFalse(prepararErro404.to(respond404))))
            .onFalse(prepararErro400.to(respond400))))
        .onFalse(prepararErro403.to(respond403))))
    .onFalse(prepararErro401.to(respond401)));
