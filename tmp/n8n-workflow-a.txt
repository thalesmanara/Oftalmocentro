import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const webhookNode = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'documents/versions/restore',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {}
    }
  },
  output: [{
    body: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' },
    headers: { authorization: 'Bearer token123' },
    query: {}
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
    requestId: 'req-0001',
    requestStartedAtMs: 1690000000000,
    method: 'POST',
    path: '/documents/versions/restore',
    headers: { authorization: 'Bearer token123' },
    body: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' },
    query: {},
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
  output: [{ ok: true, userId: 'user-0001', sessionId: 'sess-0001', user: { id: 'user-0001', isMaster: false, permissions: ['editar_documentos'] }, permissions: ['editar_documentos'] }]
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
          requiredPermission: 'editar_documentos',
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
    requestId: 'req-0001',
    requestStartedAtMs: 1690000000000,
    method: 'POST',
    path: '/documents/versions/restore',
    headers: {},
    body: { documentId: '11111111-1111-1111-1111-111111111111', versionId: '22222222-2222-2222-2222-222222222222' },
    query: {}
  }]
});

const restoreVersionSql = `=WITH src AS (
  SELECT dv.*
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id AND d.deleted_at IS NULL
  WHERE dv.document_id = '{{ $json.body.documentId }}'::uuid
    AND dv.id = '{{ $json.body.versionId }}'::uuid
  LIMIT 1
),
ins AS (
  INSERT INTO document_versions (
    document_id, version_number, is_current, status,
    file_name, file_path, file_size, mime_type, checksum,
    title_snapshot, description_snapshot,
    sector_id_snapshot, category_id_snapshot, subcategory_id_snapshot,
    responsible_user_id_snapshot, expiration_date,
    extracted_text, processing_status, created_by, metadata
  )
  SELECT
    src.document_id,
    (SELECT COALESCE(MAX(version_number), 0) FROM document_versions WHERE document_id = src.document_id) + 1,
    false,
    src.status,
    src.file_name, src.file_path, src.file_size, src.mime_type, src.checksum,
    src.title_snapshot, src.description_snapshot,
    src.sector_id_snapshot, src.category_id_snapshot, src.subcategory_id_snapshot,
    src.responsible_user_id_snapshot, src.expiration_date,
    src.extracted_text, src.processing_status,
    NULLIF('{{ $("Validar auth").first().json.userId || "" }}', '')::uuid,
    jsonb_build_object('source', 'restore', 'restoredFromVersionId', src.id, 'restoredFromVersionNumber', src.version_number)
  FROM src
  RETURNING *
),
copied AS (
  INSERT INTO document_chunks (document_id, document_version_id, chunk_order, chunk_text, chunk_index, qdrant_point_id)
  SELECT src.document_id, ins.id, dc.chunk_order, dc.chunk_text, dc.chunk_index, dc.qdrant_point_id
  FROM document_chunks dc
  JOIN src ON dc.document_version_id = src.id
  CROSS JOIN ins
  RETURNING id
),
promoted AS (
  SELECT sync_document_from_version(ins.id) AS ok, ins.id AS version_id, ins.document_id, ins.version_number
  FROM ins
)
SELECT
  d.id,
  d.title,
  d.sector_id AS "sectorId",
  s.name AS "sectorName",
  d.category_id AS "categoryId",
  c.name AS "categoryName",
  c.description AS "categoryDescription",
  d.subcategory_id AS "subcategoryId",
  sc.name AS "subcategoryName",
  sc.description AS "subcategoryDescription",
  d.semantic_description AS "semanticDescription",
  d.expiration_date AS "expirationDate",
  d.file_name AS "fileName",
  d.file_type AS "fileType",
  d.file_size AS "fileSize",
  d.file_path AS "filePath",
  d.extracted_text AS "extractedText",
  d.processing_status AS "processingStatus",
  d.processed_at AS "processedAt",
  d.responsible_user_id AS "responsibleUserId",
  ru.name AS "responsibleUserName",
  d.created_by AS "createdBy",
  cb.name AS "createdByName",
  d.updated_by AS "updatedBy",
  ub.name AS "updatedByName",
  d.created_at AS "createdAt",
  d.updated_at AS "updatedAt",
  d.current_version_id AS "currentVersionId",
  d.current_version_number AS "currentVersionNumber",
  p.version_id AS "newVersionId",
  p.version_number AS "newVersionNumber",
  src.id AS "restoredFromVersionId"
FROM documents d
JOIN promoted p ON p.document_id = d.id
CROSS JOIN src
LEFT JOIN sectors s ON s.id = d.sector_id
LEFT JOIN categories c ON c.id = d.category_id
LEFT JOIN subcategories sc ON sc.id = d.subcategory_id
LEFT JOIN users ru ON ru.id = d.responsible_user_id
LEFT JOIN users cb ON cb.id = d.created_by
LEFT JOIN users ub ON ub.id = d.updated_by;`;

const buscarERestaurarVersao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar e restaurar versao',
    parameters: {
      operation: 'executeQuery',
      query: restoreVersionSql,
      options: {}
    },
    credentials: { postgres: newCredential('Postgres account') }
  },
  output: [{
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Contrato de Prestacao de Servicos',
    sectorId: '33333333-3333-3333-3333-333333333333',
    sectorName: 'Financeiro',
    categoryId: '44444444-4444-4444-4444-444444444444',
    categoryName: 'Contratos',
    categoryDescription: 'Documentos contratuais',
    subcategoryId: null,
    subcategoryName: null,
    subcategoryDescription: null,
    semanticDescription: 'Contrato assinado com fornecedor X',
    expirationDate: '2027-01-01',
    fileName: 'contrato.pdf',
    fileType: 'application/pdf',
    fileSize: 204800,
    filePath: '/home/node/files/documents/contrato.pdf',
    extractedText: 'Texto extraido do contrato...',
    processingStatus: 'processed',
    processedAt: '2026-07-01T10:00:00.000Z',
    responsibleUserId: '55555555-5555-5555-5555-555555555555',
    responsibleUserName: 'Maria Souza',
    createdBy: '66666666-6666-6666-6666-666666666666',
    createdByName: 'Joao Silva',
    updatedBy: '66666666-6666-6666-6666-666666666666',
    updatedByName: 'Joao Silva',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-08-02T09:00:00.000Z',
    currentVersionId: '77777777-7777-7777-7777-777777777777',
    currentVersionNumber: 3,
    newVersionId: '77777777-7777-7777-7777-777777777777',
    newVersionNumber: 3,
    restoredFromVersionId: '22222222-2222-2222-2222-222222222222'
  }]
});

const montarData = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar data',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const row = $input.first().json || {};\nconst norm = $('Normalizar request').first().json;\nlet userId = '';\nlet sessionId = '';\ntry { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}\nreturn [{ json: { data: row, statusCode: 200, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path, asList: false, userId, sessionId } }];"
    }
  },
  output: [{
    data: { id: '11111111-1111-1111-1111-111111111111', newVersionId: '77777777-7777-7777-7777-777777777777', newVersionNumber: 3, restoredFromVersionId: '22222222-2222-2222-2222-222222222222' },
    statusCode: 200,
    requestId: 'req-0001',
    requestStartedAtMs: 1690000000000,
    method: 'POST',
    path: '/documents/versions/restore',
    asList: false,
    userId: 'user-0001',
    sessionId: 'sess-0001'
  }]
});

const prepararSucesso = node({
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
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}")
        }
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{
    statusCode: 200,
    requestId: 'req-0001',
    durationMs: 42,
    response: { success: true, data: { id: '11111111-1111-1111-1111-111111111111' } },
    responseHeaders: { 'X-Request-Id': 'req-0001' },
    tracking: { requestId: 'req-0001', userId: 'user-0001', sessionId: 'sess-0001', method: 'POST', path: '/documents/versions/restore', success: true, statusCode: 200, durationMs: 42 }
  }]
});

const registrarAuditoriaSucesso = node({
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
          action: 'DOCUMENT_VERSION_RESTORE',
          afterData: expr("{{ (() => { const d = $('Montar data').first().json.data || {}; return { documentId: d.id, fromVersionId: d.restoredFromVersionId, newVersionId: d.newVersionId, newVersionNumber: d.newVersionNumber }; })() }}"),
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : '' }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $json.tracking && $json.tracking.method ? $json.tracking.method : ($('Normalizar request').first().json.method || '') }}"),
          path: expr("{{ $json.tracking && $json.tracking.path ? $json.tracking.path : ($('Normalizar request').first().json.path || '') }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $json.response && $json.response.data && $json.response.data.id ? $json.response.data.id : ($('Normalizar request').first().json.body.documentId || '') }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $json.tracking && $json.tracking.sessionId ? $json.tracking.sessionId : '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: expr('{{ $json.tracking ? $json.tracking.success : true }}'),
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
    statusCode: 200,
    requestId: 'req-0001',
    durationMs: 45,
    response: { success: true, data: { id: '11111111-1111-1111-1111-111111111111' } },
    responseHeaders: { 'X-Request-Id': 'req-0001' },
    tracking: { requestId: 'req-0001', userId: 'user-0001', sessionId: 'sess-0001', method: 'POST', path: '/documents/versions/restore', success: true, statusCode: 200, durationMs: 45 }
  }]
});

const respondToWebhookNode = node({
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
            { name: 'X-Request-Id', value: expr("{{ $json.requestId || '' }}") },
            { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs || 0) }}') }
          ]
        }
      }
    }
  },
  output: [{ statusCode: 200 }]
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
  output: [{ statusCode: 401, response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticacao obrigatoria.' } }, requestId: 'req-0001' }]
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
          entries: [{ name: 'X-Request-Id', value: expr("{{ $json.requestId || '' }}") }]
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
  output: [{ statusCode: 403, response: { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissao.' } }, requestId: 'req-0001' }]
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
          entries: [{ name: 'X-Request-Id', value: expr("{{ $json.requestId || '' }}") }]
        }
      }
    }
  },
  output: [{ statusCode: 403 }]
});

export default workflow('post-document-version-restore', 'POST Document Version Restore')
  .add(webhookNode)
  .to(normalizarRequest)
  .to(validarAuth)
  .to(authOk
    .onTrue(validarPermissao
      .to(permissaoOk
        .onTrue(restaurarRequest
          .to(buscarERestaurarVersao
            .to(montarData
              .to(prepararSucesso
                .to(registrarAuditoriaSucesso
                  .to(respondToWebhookNode))))))
        .onFalse(prepararErro403.to(respond403))
      )
    )
    .onFalse(prepararErro401.to(respond401))
  );
