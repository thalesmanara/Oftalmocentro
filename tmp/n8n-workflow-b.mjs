import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const webhookNode = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'documents/versions/download',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {}
    }
  },
  output: [{
    query: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' },
    headers: { authorization: 'Bearer token123' },
    body: {}
  }]
});

const normalizarRequest = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'N3zLpj7Dij4n5p5p', cachedResultName: 'SYSTEM - NORMALIZAR REQUEST' },
      mode: 'once',
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{
    requestId: 'req-0002',
    requestStartedAtMs: 1690000000000,
    method: 'GET',
    path: '/documents/versions/download',
    headers: { authorization: 'Bearer token123' },
    body: {},
    query: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' },
    authorization: 'Bearer token123'
  }]
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
          requestId: expr("{{ $json.requestId || '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ ok: true, userId: 'user-0001', sessionId: 'sess-0001', user: { id: 'user-0001', isMaster: false, permissions: ['visualizar_documentos'] }, permissions: ['visualizar_documentos'] }]
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }]
      },
      looseTypeValidation: true
    }
  }
});

const validarPermissao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissao',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'yXW3rW8EbHXuprRJ', cachedResultName: 'AUTH - VALIDAR PERMISSAO' },
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
          requestId: expr("{{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ ok: true }]
});

const permissaoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissao ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }]
      },
      looseTypeValidation: true
    }
  }
});

const restaurarRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "return [$('Normalizar request').first()];"
    }
  },
  output: [{
    requestId: 'req-0002',
    requestStartedAtMs: 1690000000000,
    method: 'GET',
    path: '/documents/versions/download',
    headers: {},
    body: {},
    query: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' }
  }]
});

const buscarArquivoVersaoSql = `=SELECT
  d.id,
  d.title,
  dv.file_name,
  dv.mime_type AS file_type,
  dv.file_path,
  dv.id AS version_id,
  dv.version_number
FROM document_versions dv
JOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL
WHERE dv.document_id = '{{ $json.query.documentId }}'::uuid
  AND dv.id = '{{ $json.query.versionId }}'::uuid
LIMIT 1;`;

const buscarArquivoVersao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar arquivo versao',
    parameters: {
      operation: 'executeQuery',
      query: buscarArquivoVersaoSql,
      options: {}
    },
    credentials: { postgres: newCredential('Postgres account') },
    alwaysOutputData: true
  },
  output: [{
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Contrato de Prestacao de Servicos',
    file_name: 'contrato_v2.pdf',
    file_type: 'application/pdf',
    file_path: '/home/node/files/documents/contrato_v2.pdf',
    version_id: '22222222-2222-2222-2222-222222222222',
    version_number: 2
  }]
});

const versaoEncontrada = ifElse({
  version: 2.3,
  config: {
    name: 'Versao encontrada?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.id }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' }]
      },
      looseTypeValidation: true
    }
  }
});

const readWriteFilesFromDisk = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: {
    name: 'Read/Write Files from Disk',
    parameters: {
      operation: 'read',
      fileSelector: expr('{{ $json.file_path }}'),
      options: {}
    }
  },
  output: [{ fileName: 'contrato_v2.pdf', mimeType: 'application/pdf' }]
});

const respondBinary = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'binary',
      responseDataSource: 'set',
      options: {
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: expr("{{ $('Buscar arquivo versao').first().json.file_type || 'application/octet-stream' }}") },
            { name: 'Content-Disposition', value: expr("{{ 'attachment; filename=\"' + ($('Buscar arquivo versao').first().json.file_name || 'document') + '\"' }}") },
            { name: 'X-Request-Id', value: expr("{{ $('Normalizar request').first().json.requestId }}") },
            { name: 'X-Response-Time-Ms', value: expr("{{ String(Math.max(0, Date.now() - Number($('Normalizar request').first().json.requestStartedAtMs || Date.now()))) }}") }
          ]
        }
      }
    }
  },
  output: [{ statusCode: 200 }]
});

const registrarAuditoriaDownload = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria download',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_VERSION_DOWNLOAD',
          durationMs: expr("{{ Math.max(0, Date.now() - Number($('Normalizar request').first().json.requestStartedAtMs || Date.now())) }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          resourceId: expr("{{ $('Buscar arquivo versao').first().json.id || '' }}"),
          resourceType: 'document',
          response: expr('{{ {} }}'),
          responseHeaders: expr('{{ {} }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: 200,
          success: true,
          tracking: expr("{{ { requestId: $('Normalizar request').first().json.requestId, userId: $('Validar auth').first().json.userId || '', sessionId: $('Validar auth').first().json.sessionId || '', method: $('Normalizar request').first().json.method, path: $('Normalizar request').first().json.path, success: true, statusCode: 200, durationMs: Math.max(0, Date.now() - Number($('Normalizar request').first().json.requestStartedAtMs || Date.now())) } }}"),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true
  },
  output: [{ ok: true }]
});

const prepararErro404 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 404',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'DOCUMENT_FILE_NOT_FOUND',
          message: 'Arquivo da versao nao encontrado.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 404,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{
    statusCode: 404,
    requestId: 'req-0002',
    durationMs: 12,
    response: { success: false, error: { code: 'DOCUMENT_FILE_NOT_FOUND', message: 'Arquivo da versao nao encontrado.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', userId: 'user-0001', sessionId: 'sess-0001', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 404, durationMs: 12, errorCode: 'DOCUMENT_FILE_NOT_FOUND' }
  }]
});

const registrarAuditoria404 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 404',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_VERSION_DOWNLOAD',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : ($json.response && $json.response.error && $json.response.error.code ? $json.response.error.code : 'DOCUMENT_FILE_NOT_FOUND') }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $json.tracking && $json.tracking.method ? $json.tracking.method : ($('Normalizar request').first().json.method || '') }}"),
          path: expr("{{ $json.tracking && $json.tracking.path ? $json.tracking.path : ($('Normalizar request').first().json.path || '') }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Restaurar request').first().json.query?.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $json.tracking && $json.tracking.sessionId ? $json.tracking.sessionId : '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          tracking: expr('{{ $json.tracking }}'),
          userId: expr("{{ $json.tracking && $json.tracking.userId ? $json.tracking.userId : '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true
  },
  output: [{
    statusCode: 404,
    requestId: 'req-0002',
    durationMs: 12,
    response: { success: false, error: { code: 'DOCUMENT_FILE_NOT_FOUND', message: 'Arquivo da versao nao encontrado.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', userId: 'user-0001', sessionId: 'sess-0001', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 404, durationMs: 12, errorCode: 'DOCUMENT_FILE_NOT_FOUND' }
  }]
});

const respond404 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 404',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: {
        responseCode: 404,
        responseHeaders: {
          entries: [
            { name: 'X-Request-Id', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}") },
            { name: 'X-Response-Time-Ms', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}") }
          ]
        }
      }
    }
  },
  output: [{ statusCode: 404 }]
});

const prepararErro401 = node({
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
          message: 'Autenticacao obrigatoria.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 401,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{
    statusCode: 401,
    requestId: 'req-0002',
    durationMs: 8,
    response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticacao obrigatoria.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 401, durationMs: 8, errorCode: 'UNAUTHORIZED' }
  }]
});

const registrarAuditoria401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 401',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_VERSION_DOWNLOAD',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : ($json.response && $json.response.error && $json.response.error.code ? $json.response.error.code : 'UNAUTHORIZED') }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $json.tracking && $json.tracking.method ? $json.tracking.method : ($('Normalizar request').first().json.method || '') }}"),
          path: expr("{{ $json.tracking && $json.tracking.path ? $json.tracking.path : ($('Normalizar request').first().json.path || '') }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Restaurar request').first().json.query?.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $json.tracking && $json.tracking.sessionId ? $json.tracking.sessionId : '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          tracking: expr('{{ $json.tracking }}'),
          userId: expr("{{ $json.tracking && $json.tracking.userId ? $json.tracking.userId : '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true
  },
  output: [{
    statusCode: 401,
    requestId: 'req-0002',
    durationMs: 8,
    response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticacao obrigatoria.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 401, durationMs: 8, errorCode: 'UNAUTHORIZED' }
  }]
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
            { name: 'X-Request-Id', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}") },
            { name: 'X-Response-Time-Ms', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}") }
          ]
        }
      }
    }
  },
  output: [{ statusCode: 401 }]
});

const prepararErro403 = node({
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
          message: 'Sem permissao.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 403,
          requestStartedAtMs: expr("{{ $('Normalizar request').first().json.requestStartedAtMs }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{
    statusCode: 403,
    requestId: 'req-0002',
    durationMs: 9,
    response: { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissao.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 403, durationMs: 9, errorCode: 'FORBIDDEN' }
  }]
});

const registrarAuditoria403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 403',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_VERSION_DOWNLOAD',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : ($json.response && $json.response.error && $json.response.error.code ? $json.response.error.code : 'FORBIDDEN') }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $json.tracking && $json.tracking.method ? $json.tracking.method : ($('Normalizar request').first().json.method || '') }}"),
          path: expr("{{ $json.tracking && $json.tracking.path ? $json.tracking.path : ($('Normalizar request').first().json.path || '') }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Restaurar request').first().json.query?.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $json.tracking && $json.tracking.sessionId ? $json.tracking.sessionId : '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          tracking: expr('{{ $json.tracking }}'),
          userId: expr("{{ $json.tracking && $json.tracking.userId ? $json.tracking.userId : '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true
  },
  output: [{
    statusCode: 403,
    requestId: 'req-0002',
    durationMs: 9,
    response: { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissao.' } },
    responseHeaders: {},
    tracking: { requestId: 'req-0002', method: 'GET', path: '/documents/versions/download', success: false, statusCode: 403, durationMs: 9, errorCode: 'FORBIDDEN' }
  }]
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
            { name: 'X-Request-Id', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}") },
            { name: 'X-Response-Time-Ms', value: expr("{{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}") }
          ]
        }
      }
    }
  },
  output: [{ statusCode: 403 }]
});

export default workflow('get-document-version-download', 'GET Document Version Download')
  .add(webhookNode)
  .to(normalizarRequest)
  .to(validarAuth)
  .to(authOk
    .onTrue(validarPermissao
      .to(permissaoOk
        .onTrue(restaurarRequest
          .to(buscarArquivoVersao
            .to(versaoEncontrada
              .onTrue(readWriteFilesFromDisk
                .to(registrarAuditoriaDownload
                  .to(respondBinary)))
              .onFalse(prepararErro404
                .to(registrarAuditoria404
                  .to(respond404)))
            )))
        .onFalse(prepararErro403.to(registrarAuditoria403.to(respond403)))
      )
    )
    .onFalse(prepararErro401.to(registrarAuditoria401.to(respond401)))
  );
