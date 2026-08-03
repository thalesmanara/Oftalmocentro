import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      path: 'documents/ocr',
      options: {},
      httpMethod: 'POST',
      responseMode: 'responseNode',
    },
  },
  output: [{ body: { documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', force: true }, headers: { authorization: 'Bearer token' } }],
});

const normalizarRequest = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'N3zLpj7Dij4n5p5p', cachedResultName: 'SYSTEM - NORMALIZAR REQUEST' },
    },
  },
  output: [{ requestId: '33333333-3333-3333-3333-333333333333', requestStartedAtMs: 1234567890, method: 'POST', path: '/documents/ocr', headers: {} }],
});

const validarAuth = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar auth',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'P5E43ZXSJiI9wFYD', cachedResultName: 'AUTH - VALIDAR TOKEN' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $json.requestId || '' }}"),
          authorization: expr("{{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}"),
        },
      },
    },
  },
  output: [{ ok: true, userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555', user: { id: '44444444-4444-4444-4444-444444444444', isMaster: false, permissions: ['editar_documentos'] } }],
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const prepararErro401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr("{{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          message: expr("{{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 401,
          requestStartedAtMs: expr("{{ Number($('Normalizar request').first().json.requestStartedAtMs) }}"),
        },
      },
    },
  },
  output: [{ response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' } }, statusCode: 401, requestId: '33333333-3333-3333-3333-333333333333', durationMs: 5 }],
});

const registrarAuditoria401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 401',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_OCR',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : 'UNAUTHORIZED' }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Webhook').first().json.body.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: '',
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          userId: '',
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    parameters: {
      options: {
        responseCode: 401,
        responseHeaders: { entries: [{ name: 'X-Request-Id', value: expr('{{ $json.requestId }}') }, { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs ?? 0) }}') }] },
      },
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
    },
  },
  output: [{}],
});

const validarPermissao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'yXW3rW8EbHXuprRJ', cachedResultName: 'AUTH - VALIDAR PERMISSÃO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          user: expr('{{ $json.user || null }}'),
          userId: expr("{{ $json.userId || ($json.user && $json.user.id) || '' }}"),
          isMaster: expr('{{ $json.user ? $json.user.isMaster === true : false }}'),
          requestId: expr("{{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}"),
          sessionId: expr("{{ $json.sessionId || '' }}"),
          permissions: expr('{{ $json.permissions || ($json.user && $json.user.permissions) || [] }}'),
          requiredAnyOf: expr('{{ [] }}'),
          requiredPermission: 'editar_documentos',
        },
      },
    },
  },
  output: [{ ok: true }],
});

const permissaoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const prepararErro403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr("{{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}"),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          message: expr("{{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 403,
          requestStartedAtMs: expr("{{ Number($('Normalizar request').first().json.requestStartedAtMs) }}"),
        },
      },
    },
  },
  output: [{ response: { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } }, statusCode: 403, requestId: '33333333-3333-3333-3333-333333333333', durationMs: 5 }],
});

const registrarAuditoria403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 403',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_OCR',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : 'FORBIDDEN' }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Webhook').first().json.body.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: '',
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          userId: '',
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    parameters: {
      options: {
        responseCode: 403,
        responseHeaders: { entries: [{ name: 'X-Request-Id', value: expr('{{ $json.requestId }}') }, { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs ?? 0) }}') }] },
      },
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
    },
  },
  output: [{}],
});

const restaurarRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "return [$('Webhook').first()];",
    },
  },
  output: [{ body: { documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', force: true } }],
});

const buscarVersaoAtual = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar versão atual',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'WITH params AS (\n' +
        "  SELECT '{{ $json.body.documentId }}'::uuid AS document_id,\n" +
        "         NULLIF('{{ $json.body.versionId || \"\" }}','')::uuid AS version_id\n" +
        ')\n' +
        'SELECT\n' +
        '  d.id AS "documentId",\n' +
        '  dv.id AS "versionId",\n' +
        '  dv.file_path AS "filePath",\n' +
        '  dv.file_extension AS "fileExtension",\n' +
        '  dv.ocr_status AS "ocrStatus",\n' +
        '  dv.ocr_attempts AS "ocrAttempts",\n' +
        '  dv.processing_status AS "processingStatus"\n' +
        'FROM documents d\n' +
        'INNER JOIN document_versions dv ON dv.document_id = d.id\n' +
        'CROSS JOIN params p\n' +
        'WHERE d.id = p.document_id\n' +
        '  AND d.deleted_at IS NULL\n' +
        '  AND ((p.version_id IS NULL AND dv.is_current = true) OR dv.id = p.version_id)\n' +
        'ORDER BY dv.version_number DESC\n' +
        'LIMIT 1;'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', filePath: '/home/node/files/documents/a/b.pdf', fileExtension: 'pdf', ocrStatus: 'NOT_REQUIRED', ocrAttempts: 0, processingStatus: 'processed' }],
});

const documentoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Documento ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.documentId }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' }],
        combinator: 'and',
      },
    },
  },
});

const prepararErro404 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 404',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: 'DOCUMENT_NOT_FOUND',
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          message: 'Documento ou versão não encontrada.',
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: 404,
          requestStartedAtMs: expr("{{ Number($('Normalizar request').first().json.requestStartedAtMs) }}"),
        },
      },
    },
  },
  output: [{ response: { success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento ou versão não encontrada.' } }, statusCode: 404, requestId: '33333333-3333-3333-3333-333333333333', durationMs: 5 }],
});

const registrarAuditoria404 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria 404',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_OCR',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : 'DOCUMENT_NOT_FOUND' }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Webhook').first().json.body.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const respond404 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 404',
    parameters: {
      options: {
        responseCode: 404,
        responseHeaders: { entries: [{ name: 'X-Request-Id', value: expr('{{ $json.requestId }}') }, { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs ?? 0) }}') }] },
      },
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
    },
  },
  output: [{}],
});

const chamarOcrOrquestrar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Chamar OCR - ORQUESTRAR',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'LNrJ5VDUttKJe0Nr', cachedResultName: 'OCR - ORQUESTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          versionId: expr("{{ $('Buscar versão atual').first().json.versionId }}"),
          documentId: expr("{{ $('Buscar versão atual').first().json.documentId }}"),
          extractedText: '',
          textLength: 0,
          force: expr("{{ $('Webhook').first().json.body.force !== false }}"),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          mode: 'manual',
        },
      },
    },
  },
  output: [{ ok: true, needOcr: true, extractedText: 'texto extraído via ocr', textLength: 400, extractionMethod: 'ocr', ocrStatus: 'SUCCESS', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

const ocrOk = ifElse({
  version: 2.3,
  config: {
    name: 'OCR ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const prepararTextoOcr = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Preparar texto OCR',
    parameters: {
      options: {},
      assignments: {
        assignments: [
          { id: '1', name: 'documentId', type: 'string', value: expr("{{ $('Buscar versão atual').first().json.documentId }}") },
          { id: '2', name: 'versionId', type: 'string', value: expr("{{ $('Buscar versão atual').first().json.versionId }}") },
          { id: '3', name: 'extractedText', type: 'string', value: expr("{{ $json.extractedText || '' }}") },
          { id: '4', name: 'textLength', type: 'string', value: expr("{{ ($json.extractedText || '').length }}") },
          { id: '5', name: 'extractionMethod', type: 'string', value: expr("{{ $json.extractionMethod || 'ocr' }}") },
          { id: '6', name: 'ocrStatus', type: 'string', value: expr("{{ $json.ocrStatus || 'SUCCESS' }}") },
        ],
      },
    },
  },
  output: [{ documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', extractedText: 'texto extraído via ocr', textLength: 400, extractionMethod: 'ocr', ocrStatus: 'SUCCESS' }],
});

const atualizarTextoOcr = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar texto extraído OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        'SET\n' +
        '  extracted_text = \'{{ $json.extractedText.replace(/\'/g, "\'\'") }}\',\n' +
        "  processing_status = 'processed',\n" +
        "  status = 'READY'\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING\n' +
        '  id AS "versionId",\n' +
        '  document_id AS "documentId",\n' +
        '  processing_status AS "processingStatus",\n' +
        '  LENGTH(extracted_text) AS "textLength";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', processingStatus: 'processed', textLength: 400 }],
});

const deletarChunksOcr = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Deletar chunks antigos OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'DELETE FROM document_chunks\n' +
        "WHERE document_version_id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING document_version_id;'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ document_version_id: '11111111-1111-1111-1111-111111111111' }],
});

const gerarChunksOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gerar chunks OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const prep = $('Preparar texto OCR').first().json;\n" +
        'const documentId = prep.documentId;\n' +
        'const versionId = prep.versionId;\n' +
        "const text = prep.extractedText || '';\n" +
        '\n' +
        "const cleanText = text.replace(/\\s+/g, ' ').trim();\n" +
        'const chunkSize = 1200;\n' +
        'const overlap = 150;\n' +
        'const chunks = [];\n' +
        '\n' +
        'for (let i = 0; i < cleanText.length; i += chunkSize - overlap) {\n' +
        '  const content = cleanText.slice(i, i + chunkSize).trim();\n' +
        '  if (content.length > 50) {\n' +
        '    chunks.push({\n' +
        '      json: {\n' +
        '        documentId,\n' +
        '        versionId,\n' +
        '        chunkIndex: chunks.length,\n' +
        '        content,\n' +
        '      },\n' +
        '    });\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        'if (!chunks.length) {\n' +
        "  return [{ json: { documentId, versionId, chunkIndex: -1, content: '', skip: true } }];\n" +
        '}\n' +
        '\n' +
        'return chunks;',
    },
  },
  output: [{ documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', chunkIndex: 0, content: 'trecho do texto extraído via ocr' }],
});

const salvarChunksOcr = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Salvar chunks OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'INSERT INTO document_chunks (\n' +
        '  document_id,\n' +
        '  document_version_id,\n' +
        '  chunk_order,\n' +
        '  chunk_text\n' +
        ')\n' +
        'SELECT\n' +
        "  '{{ $json.documentId }}'::uuid,\n" +
        "  '{{ $json.versionId }}'::uuid,\n" +
        '  {{ Number($json.chunkIndex) }},\n' +
        '  \'{{ ($json.content || "").replace(/\'/g, "\'\'") }}\'\n' +
        "WHERE '{{ $json.skip || false }}' <> 'true'\n" +
        'RETURNING\n' +
        '  id,\n' +
        '  document_id AS "documentId",\n' +
        '  document_version_id AS "versionId",\n' +
        '  chunk_order AS "chunkOrder";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ id: '66666666-6666-6666-6666-666666666666', documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', chunkOrder: 0 }],
});

const promoverVersaoOcr = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Promover versão OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'WITH promoted AS (\n' +
        "  SELECT sync_document_from_version('{{ $('Preparar texto OCR').first().json.versionId }}'::uuid) AS synced\n" +
        ')\n' +
        'UPDATE documents d\n' +
        'SET\n' +
        "  processing_status = 'processed',\n" +
        '  processed_at = NOW(),\n' +
        '  updated_at = NOW()\n' +
        'FROM promoted\n' +
        "WHERE d.id = '{{ $('Preparar texto OCR').first().json.documentId }}'::uuid\n" +
        'RETURNING\n' +
        '  d.id AS "documentId",\n' +
        '  d.current_version_number AS "versionNumber",\n' +
        '  d.processing_status AS "processingStatus",\n' +
        '  d.processed_at AS "processedAt";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ documentId: '22222222-2222-2222-2222-222222222222', versionNumber: 2, processingStatus: 'processed', processedAt: '2026-08-03T00:00:00.000Z' }],
});

const montarDataOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar data OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const prep = $('Preparar texto OCR').first().json;\n" +
        "const promoted = $('Promover versão OCR').first().json || {};\n" +
        "const chunks = $('Salvar chunks OCR').all().map((i) => i.json).filter((j) => j && j.id);\n" +
        "const norm = $('Normalizar request').first().json;\n" +
        "const auth = $('Validar auth').first().json || {};\n" +
        'const data = {\n' +
        '  success: true,\n' +
        "  message: 'OCR processado com sucesso.',\n" +
        '  documentId: prep.documentId,\n' +
        '  versionId: prep.versionId,\n' +
        '  versionNumber: promoted.versionNumber || null,\n' +
        '  extractionMethod: prep.extractionMethod,\n' +
        '  ocrStatus: prep.ocrStatus,\n' +
        '  textLength: prep.textLength,\n' +
        '  chunks: chunks.length,\n' +
        "  processingStatus: promoted.processingStatus || 'processed',\n" +
        '};\n' +
        'return [{ json: { data, asList: false, statusCode: 200, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path, userId: auth.userId || \'\', sessionId: auth.sessionId || \'\' } }];',
    },
  },
  output: [{ data: { success: true, message: 'OCR processado com sucesso.', documentId: '22222222-2222-2222-2222-222222222222', versionId: '11111111-1111-1111-1111-111111111111', extractionMethod: 'ocr', ocrStatus: 'SUCCESS', textLength: 400, chunks: 3 }, asList: false, statusCode: 200, requestId: '33333333-3333-3333-3333-333333333333', method: 'POST', path: '/documents/ocr', userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555' }],
});

const prepararSucessoOcr = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso OCR',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'zE5LRjZfbXw8Ymll', cachedResultName: 'SYSTEM - PREPARAR SUCESSO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          data: expr('{{ $json.data }}'),
          path: expr('{{ $json.path }}'),
          method: expr('{{ $json.method }}'),
          userId: expr("{{ $json.userId || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          sessionId: expr("{{ $json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          requestStartedAtMs: expr('{{ Number($json.requestStartedAtMs) }}'),
        },
      },
    },
  },
  output: [{ response: { success: true, data: {} }, statusCode: 200, requestId: '33333333-3333-3333-3333-333333333333', durationMs: 120 }],
});

const registrarAuditoriaSucessoOcr = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria sucesso OCR',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_OCR',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: '',
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          metadata: expr("{{ { versionId: $('Preparar texto OCR').first().json.versionId, ocrStatus: $('Preparar texto OCR').first().json.ocrStatus, extractionMethod: $('Preparar texto OCR').first().json.extractionMethod, textLength: $('Preparar texto OCR').first().json.textLength } }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Preparar texto OCR').first().json.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: true,
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const respondToWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      options: {
        responseCode: expr('{{ $json.statusCode }}'),
        responseHeaders: { entries: [{ name: 'X-Request-Id', value: expr('{{ $json.requestId }}') }, { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs ?? 0) }}') }] },
      },
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
    },
  },
  output: [{}],
});

const tratarErroOcrWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Tratar erro OCR webhook',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const row = $input.first().json || {};\n' +
        "const code = row.code || 'OCR_FAILED';\n" +
        'let statusCode = 500;\n' +
        "if (code === 'OCR_MANUAL_REVIEW' || code === 'OCR_VERSION_NOT_FOUND') statusCode = 422;\n" +
        "else if (code === 'OCR_BUSY') statusCode = 409;\n" +
        "else if (code === 'OCR_PATH_INVALID' || code === 'OCR_DERIVED_PATH_INVALID') statusCode = 500;\n" +
        "return [{ json: { code, message: row.message || 'Falha ao processar OCR do documento.', statusCode, versionId: row.versionId, documentId: row.documentId } }];",
    },
  },
  output: [{ code: 'OCR_MANUAL_REVIEW', message: 'Documento requer revisão manual.', statusCode: 422, versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222' }],
});

const prepararErroOcrWebhook = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro OCR webhook',
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'r3iSBV1ClKOxS2UI', cachedResultName: 'SYSTEM - PREPARAR ERRO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: expr('{{ $json.code }}'),
          path: expr("{{ $('Normalizar request').first().json.path }}"),
          method: expr("{{ $('Normalizar request').first().json.method }}"),
          message: expr('{{ $json.message }}'),
          requestId: expr("{{ $('Normalizar request').first().json.requestId }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          requestStartedAtMs: expr("{{ Number($('Normalizar request').first().json.requestStartedAtMs) }}"),
        },
      },
    },
  },
  output: [{ response: { success: false, error: { code: 'OCR_MANUAL_REVIEW', message: 'Documento requer revisão manual.' } }, statusCode: 422, requestId: '33333333-3333-3333-3333-333333333333', durationMs: 30 }],
});

const registrarAuditoriaErroOcrWebhook = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Registrar auditoria erro OCR webhook',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'DOCUMENT_OCR',
          durationMs: expr('{{ $json.durationMs }}'),
          errorCode: expr("{{ $json.tracking && $json.tracking.errorCode ? $json.tracking.errorCode : ($json.response && $json.response.error && $json.response.error.code ? $json.response.error.code : 'OCR_FAILED') }}"),
          headers: expr("{{ $('Normalizar request').first().json.headers }}"),
          method: expr("{{ $('Normalizar request').first().json.method || '' }}"),
          path: expr("{{ $('Normalizar request').first().json.path || '' }}"),
          requestId: expr('{{ $json.requestId }}'),
          resourceId: expr("{{ $('Buscar versão atual').first().json.documentId || '' }}"),
          resourceType: 'document',
          response: expr('{{ $json.response }}'),
          responseHeaders: expr('{{ $json.responseHeaders }}'),
          sessionId: expr("{{ $('Validar auth').first().json.sessionId || '' }}"),
          statusCode: expr('{{ $json.statusCode }}'),
          success: false,
          userId: expr("{{ $('Validar auth').first().json.userId || '' }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const respondErroOcrWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond erro OCR webhook',
    parameters: {
      options: {
        responseCode: expr('{{ $json.statusCode || 500 }}'),
        responseHeaders: { entries: [{ name: 'X-Request-Id', value: expr('{{ $json.requestId }}') }, { name: 'X-Response-Time-Ms', value: expr('{{ String($json.durationMs ?? 0) }}') }] },
      },
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
    },
  },
  output: [{}],
});

export default workflow('post-documento-ocr', 'POST Documento OCR')
  .add(webhookTrigger)
  .to(normalizarRequest)
  .to(validarAuth)
  .to(authOk
    .onTrue(validarPermissao
      .to(permissaoOk
        .onTrue(restaurarRequest
          .to(buscarVersaoAtual)
          .to(documentoOk
            .onTrue(chamarOcrOrquestrar
              .to(ocrOk
                .onTrue(prepararTextoOcr
                  .to(atualizarTextoOcr)
                  .to(deletarChunksOcr)
                  .to(gerarChunksOcr)
                  .to(salvarChunksOcr)
                  .to(promoverVersaoOcr)
                  .to(montarDataOcr)
                  .to(prepararSucessoOcr)
                  .to(registrarAuditoriaSucessoOcr)
                  .to(respondToWebhook)
                )
                .onFalse(tratarErroOcrWebhook
                  .to(prepararErroOcrWebhook)
                  .to(registrarAuditoriaErroOcrWebhook)
                  .to(respondErroOcrWebhook)
                )
              )
            )
            .onFalse(prepararErro404.to(registrarAuditoria404).to(respond404))
          )
        )
        .onFalse(prepararErro403.to(registrarAuditoria403).to(respond403))
      )
    )
    .onFalse(prepararErro401.to(registrarAuditoria401).to(respond401))
  );
