import { workflow, node, trigger, ifElse, switchCase, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const ocrTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'versionId', type: 'string' },
          { name: 'documentId', type: 'string' },
          { name: 'extractedText', type: 'string' },
          { name: 'textLength', type: 'number' },
          { name: 'force', type: 'boolean' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
          { name: 'mode', type: 'string' },
        ],
      },
    },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', extractedText: '', textLength: 0, force: false, requestId: '33333333-3333-3333-3333-333333333333', userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555', mode: 'auto' }],
});

const carregarVersao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar versão e config',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'WITH ver AS (\n' +
        '  SELECT\n' +
        '    dv.id AS "versionId",\n' +
        '    dv.document_id AS "documentId",\n' +
        '    dv.file_path AS "filePath",\n' +
        '    dv.file_extension AS "fileExtension",\n' +
        '    dv.ocr_status AS "ocrStatus",\n' +
        '    dv.ocr_attempts AS "ocrAttempts",\n' +
        '    dv.processing_status AS "processingStatus",\n' +
        '    dv.status AS "status"\n' +
        '  FROM document_versions dv\n' +
        "  WHERE dv.id = '{{ $json.versionId }}'::uuid\n" +
        '),\n' +
        'secrets AS (\n' +
        '  SELECT\n' +
        "    MAX(CASE WHEN key = 'ocr_enabled' THEN value END) AS ocr_enabled,\n" +
        "    MAX(CASE WHEN key = 'ocr_min_text_chars' THEN value END) AS ocr_min_text_chars,\n" +
        "    MAX(CASE WHEN key = 'ocr_max_attempts' THEN value END) AS ocr_max_attempts,\n" +
        "    MAX(CASE WHEN key = 'ocr_timeout_seconds' THEN value END) AS ocr_timeout_seconds,\n" +
        "    MAX(CASE WHEN key = 'ocr_languages' THEN value END) AS ocr_languages\n" +
        '  FROM app_secrets\n' +
        "  WHERE key IN ('ocr_enabled','ocr_min_text_chars','ocr_max_attempts','ocr_timeout_seconds','ocr_languages')\n" +
        '),\n' +
        'concurrency AS (\n' +
        '  SELECT COUNT(*)::int AS active_count\n' +
        '  FROM document_versions\n' +
        "  WHERE ocr_status = 'PROCESSING'\n" +
        "    AND ocr_started_at > NOW() - INTERVAL '15 minutes'\n" +
        "    AND id <> '{{ $json.versionId }}'::uuid\n" +
        ')\n' +
        'SELECT\n' +
        '  ver."versionId",\n' +
        '  ver."documentId",\n' +
        '  ver."filePath",\n' +
        '  ver."fileExtension",\n' +
        '  ver."ocrStatus",\n' +
        '  ver."ocrAttempts",\n' +
        '  ver."processingStatus",\n' +
        '  ver."status",\n' +
        '  secrets.ocr_enabled AS "ocrEnabled",\n' +
        '  secrets.ocr_min_text_chars AS "ocrMinTextChars",\n' +
        '  secrets.ocr_max_attempts AS "ocrMaxAttempts",\n' +
        '  secrets.ocr_timeout_seconds AS "ocrTimeoutSeconds",\n' +
        '  secrets.ocr_languages AS "ocrLanguages",\n' +
        '  concurrency.active_count AS "activeOcrCount"\n' +
        'FROM secrets\n' +
        'CROSS JOIN concurrency\n' +
        'LEFT JOIN ver ON true;'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', filePath: '/home/node/files/documents/a/b.pdf', fileExtension: 'pdf', ocrStatus: null, ocrAttempts: 0, processingStatus: 'processing', status: 'PROCESSING', ocrEnabled: 'true', ocrMinTextChars: '80', ocrMaxAttempts: '3', ocrTimeoutSeconds: '180', ocrLanguages: 'por+eng', activeOcrCount: 0 }],
});

const avaliarNode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const trig = $('Trigger').first().json;\n" +
        'const cfg = $input.first().json;\n' +
        '\n' +
        'const versionId = trig.versionId;\n' +
        'const documentId = trig.documentId || cfg.documentId;\n' +
        "const requestId = trig.requestId || '';\n" +
        "const userId = trig.userId || '';\n" +
        "const sessionId = trig.sessionId || '';\n" +
        "const force = trig.force === true || trig.force === 'true';\n" +
        'const textLength = Number(trig.textLength || 0);\n' +
        "const extractedText = trig.extractedText || '';\n" +
        "const modeIn = trig.mode || 'auto';\n" +
        '\n' +
        'const versionExists = !!cfg.versionId;\n' +
        "const ocrEnabled = String(cfg.ocrEnabled ?? 'true').toLowerCase() === 'true';\n" +
        'const minChars = Number(cfg.ocrMinTextChars ?? 80);\n' +
        'const maxAttempts = Number(cfg.ocrMaxAttempts ?? 3);\n' +
        "const languages = cfg.ocrLanguages || 'por+eng';\n" +
        "const fileExtension = String(cfg.fileExtension || '').toLowerCase().replace(/^\\./, '');\n" +
        "const filePath = cfg.filePath || '';\n" +
        'const currentOcrStatus = cfg.ocrStatus || null;\n' +
        'const ocrAttempts = Number(cfg.ocrAttempts || 0);\n' +
        'const activeOcrCount = Number(cfg.activeOcrCount || 0);\n' +
        '\n' +
        'const base = {\n' +
        '  versionId, documentId, requestId, userId, sessionId, mode: modeIn,\n' +
        '  force, textLength, extractedText, filePath, languages, minChars, maxAttempts, ocrAttempts,\n' +
        '};\n' +
        '\n' +
        'function result(extra, route) {\n' +
        "  return [{ json: { ...base, ...extra, stage: 'AVALIAR', route } }];\n" +
        '}\n' +
        '\n' +
        'if (!versionExists) {\n' +
        "  return result({ ok: false, needOcr: false, code: 'OCR_VERSION_NOT_FOUND', message: 'Versão não encontrada para OCR.', extractionMethod: null, ocrStatus: null }, 'NOT_FOUND');\n" +
        '}\n' +
        '\n' +
        'if (!ocrEnabled) {\n' +
        "  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'SKIPPED' }, 'LIGHT_UPDATE');\n" +
        '}\n' +
        '\n' +
        "if (fileExtension !== 'pdf') {\n" +
        "  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'NOT_APPLICABLE' }, 'LIGHT_UPDATE');\n" +
        '}\n' +
        '\n' +
        'if (!force && textLength >= minChars) {\n' +
        "  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'NOT_REQUIRED' }, 'LIGHT_UPDATE');\n" +
        '}\n' +
        '\n' +
        'if (ocrAttempts >= maxAttempts && !force) {\n' +
        "  return result({ ok: false, needOcr: false, code: 'OCR_MANUAL_REVIEW', message: 'Número máximo de tentativas de OCR atingido.', extractionMethod: 'tika', ocrStatus: 'MANUAL_REVIEW' }, 'MANUAL_REVIEW');\n" +
        '}\n' +
        '\n' +
        "if (activeOcrCount >= 1 && currentOcrStatus !== 'PROCESSING') {\n" +
        "  return result({ ok: false, needOcr: false, code: 'OCR_BUSY', message: 'Já existe um processamento de OCR em andamento.', retryable: true, extractionMethod: null, ocrStatus: 'OCR_BUSY' }, 'BUSY');\n" +
        '}\n' +
        '\n' +
        "return result({ ok: true, needOcr: true }, 'PROCEED');",
    },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333', userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555', mode: 'auto', force: false, textLength: 10, extractedText: '', filePath: '/home/node/files/documents/a/b.pdf', languages: 'por+eng', minChars: 80, maxAttempts: 3, ocrAttempts: 0, ok: true, needOcr: true, stage: 'AVALIAR', route: 'PROCEED' }],
});

const rotearAvaliacao = switchCase({
  version: 3.2,
  config: {
    name: 'Rotear avaliação',
    parameters: {
      rules: {
        values: [
          {
            outputKey: 'proceed',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'PROCEED' }],
              combinator: 'and',
            },
          },
          {
            outputKey: 'light',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'LIGHT_UPDATE' }],
              combinator: 'and',
            },
          },
          {
            outputKey: 'manual',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'MANUAL_REVIEW' }],
              combinator: 'and',
            },
          },
          {
            outputKey: 'other',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [
                { leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'BUSY' },
                { leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'NOT_FOUND' },
              ],
              combinator: 'or',
            },
          },
        ],
      },
      options: {},
    },
  },
});

// ---- LIGHT_UPDATE branch ----
const atualizarExtracaoLeve = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar extração leve',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET extraction_method = '{{ $json.extractionMethod }}',\n" +
        "    ocr_status = '{{ $json.ocrStatus }}'\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId", extraction_method AS "extractionMethod", ocr_status AS "ocrStatus";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', extractionMethod: 'tika', ocrStatus: 'NOT_REQUIRED' }],
});

const montarRetornoSemOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno sem OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const av = $('Avaliar').first().json;\n" +
        'const upd = $input.first().json || {};\n' +
        'return [{ json: {\n' +
        '  ok: true,\n' +
        '  needOcr: false,\n' +
        '  extractedText: av.extractedText,\n' +
        '  textLength: av.textLength,\n' +
        '  extractionMethod: upd.extractionMethod || av.extractionMethod,\n' +
        '  ocrStatus: upd.ocrStatus || av.ocrStatus,\n' +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: true, needOcr: false, extractedText: 'texto extraído', textLength: 500, extractionMethod: 'tika', ocrStatus: 'NOT_REQUIRED', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

// ---- MANUAL_REVIEW branch (from Avaliar directly) ----
const marcarRevisaoManual = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar revisão manual',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_status = 'MANUAL_REVIEW'\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId", ocr_attempts AS "ocrAttempts";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', ocrAttempts: 3 }],
});

const auditoriaRevisaoManual = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria revisão manual',
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
          requestId: expr("{{ $('Avaliar').first().json.requestId }}"),
          userId: expr("{{ $('Avaliar').first().json.userId }}"),
          sessionId: expr("{{ $('Avaliar').first().json.sessionId }}"),
          action: 'OCR_MANUAL_REVIEW',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Avaliar').first().json.versionId }}"),
          success: false,
          errorCode: 'OCR_MANUAL_REVIEW',
          metadata: expr("{{ { versionId: $('Avaliar').first().json.versionId, ocrAttempts: $json.ocrAttempts, maxAttempts: $('Avaliar').first().json.maxAttempts } }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } }],
});

const montarRetornoRevisaoManual = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno revisão manual',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const av = $('Avaliar').first().json;\n" +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: false,\n' +
        "  code: 'OCR_MANUAL_REVIEW',\n" +
        "  message: av.message || 'Documento requer revisão manual para OCR.',\n" +
        "  ocrStatus: 'MANUAL_REVIEW',\n" +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: false, code: 'OCR_MANUAL_REVIEW', message: 'Documento requer revisão manual para OCR.', ocrStatus: 'MANUAL_REVIEW', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

// ---- OTHER (BUSY / NOT_FOUND) branch ----
const montarRetornoBloqueado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno bloqueado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const av = $input.first().json;\n' +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: false,\n' +
        "  code: av.code || 'OCR_BUSY',\n" +
        "  message: av.message || 'OCR indisponível no momento.',\n" +
        '  retryable: av.retryable ?? true,\n' +
        "  ocrStatus: av.ocrStatus || 'OCR_BUSY',\n" +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: false, code: 'OCR_BUSY', message: 'Já existe um processamento de OCR em andamento.', retryable: true, ocrStatus: 'OCR_BUSY', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

// ---- PROCEED branch ----
const marcarOcrIniciado = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar OCR iniciado',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'WITH v AS (\n' +
        '  UPDATE document_versions\n' +
        "  SET ocr_status = 'PROCESSING',\n" +
        '      ocr_attempts = ocr_attempts + 1,\n' +
        '      ocr_started_at = NOW(),\n' +
        "      ocr_engine = 'ocrmypdf+tesseract',\n" +
        "      ocr_languages = '{{ $json.languages }}'\n" +
        "  WHERE id = '{{ $json.versionId }}'::uuid\n" +
        '  RETURNING id, document_id, file_path, ocr_attempts\n' +
        '),\n' +
        'd AS (\n' +
        '  UPDATE documents\n' +
        "  SET processing_status = 'processing', updated_at = NOW()\n" +
        '  FROM v\n' +
        '  WHERE documents.id = v.document_id\n' +
        "    AND documents.processing_status <> 'processing'\n" +
        '  RETURNING documents.id\n' +
        ')\n' +
        'SELECT\n' +
        '  v.id AS "versionId",\n' +
        '  v.document_id AS "documentId",\n' +
        '  v.file_path AS "filePath",\n' +
        '  v.ocr_attempts AS "ocrAttempts"\n' +
        'FROM v;'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', filePath: '/home/node/files/documents/a/b.pdf', ocrAttempts: 1 }],
});

const auditoriaRequeridoOuRetry = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria OCR requerido ou retry',
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
          requestId: expr("{{ $('Avaliar').first().json.requestId }}"),
          userId: expr("{{ $('Avaliar').first().json.userId }}"),
          sessionId: expr("{{ $('Avaliar').first().json.sessionId }}"),
          action: expr('{{ Number($json.ocrAttempts) <= 1 ? "OCR_REQUIRED" : "OCR_RETRY" }}'),
          resourceType: 'document_version',
          resourceId: expr('{{ $json.versionId }}'),
          success: true,
          metadata: expr("{{ { versionId: $json.versionId, ocrAttempts: $json.ocrAttempts, languages: $('Avaliar').first().json.languages } }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const auditoriaOcrIniciado = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria OCR iniciado',
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
          requestId: expr("{{ $('Avaliar').first().json.requestId }}"),
          userId: expr("{{ $('Avaliar').first().json.userId }}"),
          sessionId: expr("{{ $('Avaliar').first().json.sessionId }}"),
          action: 'OCR_STARTED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Marcar OCR iniciado').first().json.versionId }}"),
          success: true,
          metadata: expr("{{ { versionId: $('Marcar OCR iniciado').first().json.versionId, ocrAttempts: $('Marcar OCR iniciado').first().json.ocrAttempts, languages: $('Avaliar').first().json.languages } }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const validarCaminhoOriginal = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar caminho original',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const marcado = $('Marcar OCR iniciado').first().json;\n" +
        "const filePath = marcado.filePath || '';\n" +
        "const allowedRoot = '/home/node/files/';\n" +
        "const safe = typeof filePath === 'string' && filePath.startsWith(allowedRoot) && !filePath.includes('..');\n" +
        'return [{ json: { ...marcado, filePath, pathSafe: safe } }];',
    },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', filePath: '/home/node/files/documents/a/b.pdf', ocrAttempts: 1, pathSafe: true }],
});

const caminhoOriginalSeguro = ifElse({
  version: 2.3,
  config: {
    name: 'Caminho original seguro?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.pathSafe }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const marcarFalhaCaminhoOriginal = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar falha caminho original',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_status = 'FAILED', ocr_error_code = 'OCR_PATH_INVALID', ocr_finished_at = NOW()\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222' }],
});

const auditoriaFalhaCaminhoOriginal = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria falha caminho original',
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
          requestId: expr("{{ $('Avaliar').first().json.requestId }}"),
          userId: expr("{{ $('Avaliar').first().json.userId }}"),
          sessionId: expr("{{ $('Avaliar').first().json.sessionId }}"),
          action: 'OCR_FAILED',
          resourceType: 'document_version',
          resourceId: expr('{{ $json.versionId }}'),
          success: false,
          errorCode: 'OCR_PATH_INVALID',
          metadata: expr('{{ { versionId: $json.versionId } }}'),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoFalhaCaminho = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno falha caminho',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const av = $('Avaliar').first().json;\n" +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: true,\n' +
        "  code: 'OCR_PATH_INVALID',\n" +
        "  message: 'Caminho de arquivo inválido para OCR.',\n" +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        "  ocrStatus: 'FAILED',\n" +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: true, code: 'OCR_PATH_INVALID', message: 'Caminho de arquivo inválido para OCR.', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333', ocrStatus: 'FAILED' }],
});

const lerArquivoOriginal = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: {
    name: 'Ler arquivo original',
    parameters: {
      operation: 'read',
      fileSelector: expr("{{ $('Validar caminho original').first().json.filePath }}"),
      options: {},
    },
  },
  output: [{ fileName: 'b.pdf' }],
});

const chamarServicoOcr = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Chamar serviço OCR',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'POST',
      url: expr("{{ 'http://ocr:8080/ocr?languages=' + encodeURIComponent($('Avaliar').first().json.languages) + '&force=' + ($('Avaliar').first().json.force ? 'true' : 'false') }}"),
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      options: {
        timeout: 200000,
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'file' } },
      },
    },
  },
  output: [{ statusCode: 200, headers: { 'x-ocr-checksum': 'abc123', 'x-ocr-duration-ms': '4200', 'x-ocr-engine': 'ocrmypdf+tesseract', 'x-ocr-languages': 'por+eng' } }],
});

const validarOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const http = $input.first();\n' +
        'const httpJson = http.json || {};\n' +
        'const statusCode = Number(httpJson.statusCode ?? httpJson.status ?? 0);\n' +
        'const hasBinary = !!(http.binary && http.binary.data);\n' +
        "const av = $('Avaliar').first().json;\n" +
        "const marcado = $('Marcar OCR iniciado').first().json;\n" +
        '\n' +
        'const headers = httpJson.headers || {};\n' +
        "const checksum = headers['x-ocr-checksum'] || headers['X-OCR-Checksum'] || null;\n" +
        "const durationMsHeader = Number(headers['x-ocr-duration-ms'] || headers['X-OCR-Duration-Ms'] || 0) || null;\n" +
        "const engine = headers['x-ocr-engine'] || headers['X-OCR-Engine'] || 'ocrmypdf+tesseract';\n" +
        "const languagesHeader = headers['x-ocr-languages'] || headers['X-OCR-Languages'] || av.languages;\n" +
        '\n' +
        'let ok = statusCode === 200 && hasBinary;\n' +
        'let code = null;\n' +
        'if (!ok) {\n' +
        '  if (statusCode === 408 || statusCode === 504) code = "OCR_TIMEOUT";\n' +
        '  else if (statusCode >= 500) code = "OCR_ENGINE_ERROR";\n' +
        '  else if (statusCode === 422 || statusCode === 400) code = "OCR_UNPROCESSABLE";\n' +
        '  else if (statusCode === 0) code = "OCR_UNAVAILABLE";\n' +
        '  else code = "OCR_FAILED";\n' +
        '}\n' +
        '\n' +
        'const ocrAttempts = Number(marcado.ocrAttempts || 0);\n' +
        'const maxAttempts = Number(av.maxAttempts || 3);\n' +
        'const nextOcrStatus = ocrAttempts >= maxAttempts ? "MANUAL_REVIEW" : "FAILED";\n' +
        '\n' +
        'const result = {\n' +
        '  json: {\n' +
        '    ok,\n' +
        '    code,\n' +
        '    nextOcrStatus,\n' +
        '    statusCode,\n' +
        '    checksum,\n' +
        '    durationMs: durationMsHeader,\n' +
        '    engine,\n' +
        '    languages: languagesHeader,\n' +
        '    versionId: av.versionId,\n' +
        '    documentId: av.documentId,\n' +
        '    requestId: av.requestId,\n' +
        '    userId: av.userId,\n' +
        '    sessionId: av.sessionId,\n' +
        '    filePath: marcado.filePath,\n' +
        '    ocrAttempts,\n' +
        '    maxAttempts,\n' +
        '    minChars: av.minChars,\n' +
        '  },\n' +
        '};\n' +
        'if (ok && http.binary) result.binary = http.binary;\n' +
        'return [result];',
    },
  },
  output: [{ ok: true, code: null, nextOcrStatus: 'FAILED', statusCode: 200, checksum: 'abc123', durationMs: 4200, engine: 'ocrmypdf+tesseract', languages: 'por+eng', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333', userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555', filePath: '/home/node/files/documents/a/b.pdf', ocrAttempts: 1, maxAttempts: 3, minChars: 80 }],
});

const ocrValido = ifElse({
  version: 2.3,
  config: {
    name: 'OCR válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const marcarOcrFalhado = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar OCR falhado',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_status = '{{ $json.nextOcrStatus }}',\n" +
        "    ocr_error_code = '{{ $json.code }}',\n" +
        '    ocr_finished_at = NOW()\n' +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId", ocr_status AS "ocrStatus";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', ocrStatus: 'FAILED' }],
});

const auditoriaOcrFalhado = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria OCR falhado',
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
          requestId: expr("{{ $('Validar OCR').first().json.requestId }}"),
          userId: expr("{{ $('Validar OCR').first().json.userId }}"),
          sessionId: expr("{{ $('Validar OCR').first().json.sessionId }}"),
          action: 'OCR_FAILED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Validar OCR').first().json.versionId }}"),
          success: false,
          errorCode: expr("{{ $('Validar OCR').first().json.code }}"),
          metadata: expr("{{ { versionId: $('Validar OCR').first().json.versionId, durationMs: $('Validar OCR').first().json.durationMs, engine: $('Validar OCR').first().json.engine, languages: $('Validar OCR').first().json.languages, attempts: $('Validar OCR').first().json.ocrAttempts } }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoFalhaOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno falha OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const val = $('Validar OCR').first().json;\n" +
        'const upd = $input.first().json || {};\n' +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: true,\n' +
        '  code: val.code,\n' +
        "  message: 'Falha ao processar OCR do documento.',\n" +
        '  ocrStatus: upd.ocrStatus || val.nextOcrStatus,\n' +
        '  versionId: val.versionId,\n' +
        '  documentId: val.documentId,\n' +
        '  requestId: val.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: true, code: 'OCR_ENGINE_ERROR', message: 'Falha ao processar OCR do documento.', ocrStatus: 'FAILED', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

const prepararCaminhoDerivado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar caminho derivado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const val = $('Validar OCR').first().json;\n" +
        "const original = val.filePath || '';\n" +
        "const lastSlash = original.lastIndexOf('/');\n" +
        "const dir = lastSlash >= 0 ? original.slice(0, lastSlash) : '';\n" +
        'const fileName = lastSlash >= 0 ? original.slice(lastSlash + 1) : original;\n' +
        "const lastDot = fileName.lastIndexOf('.');\n" +
        'const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;\n' +
        "const shortId = String(val.versionId || '').replace(/-/g, '').slice(0, 8);\n" +
        "const derivedFileName = baseName + '.ocr.' + shortId + '.pdf';\n" +
        "const derivedPath = dir + '/' + derivedFileName;\n" +
        "const allowedRoot = '/home/node/files/documents/';\n" +
        "const safe = derivedPath.startsWith(allowedRoot) && !derivedPath.includes('..') && derivedPath !== original;\n" +
        'const inputItem = $input.first();\n' +
        'const result = { json: { ...val, derivedPath, derivedFileName, derivedSafe: safe } };\n' +
        'if (inputItem.binary) result.binary = inputItem.binary;\n' +
        'return [result];',
    },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', derivedPath: '/home/node/files/documents/a/b.ocr.11111111.pdf', derivedFileName: 'b.ocr.11111111.pdf', derivedSafe: true }],
});

const caminhoDerivadoSeguro = ifElse({
  version: 2.3,
  config: {
    name: 'Caminho derivado seguro?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.derivedSafe }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
        combinator: 'and',
      },
    },
  },
});

const marcarFalhaCaminhoDerivado = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar falha caminho derivado',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_status = 'FAILED', ocr_error_code = 'OCR_DERIVED_PATH_INVALID', ocr_finished_at = NOW()\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222' }],
});

const auditoriaFalhaCaminhoDerivado = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria falha caminho derivado',
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
          requestId: expr("{{ $('Validar OCR').first().json.requestId }}"),
          userId: expr("{{ $('Validar OCR').first().json.userId }}"),
          sessionId: expr("{{ $('Validar OCR').first().json.sessionId }}"),
          action: 'OCR_FAILED',
          resourceType: 'document_version',
          resourceId: expr('{{ $json.versionId }}'),
          success: false,
          errorCode: 'OCR_DERIVED_PATH_INVALID',
          metadata: expr('{{ { versionId: $json.versionId } }}'),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoFalhaCaminhoDerivado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno falha caminho derivado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const val = $('Validar OCR').first().json;\n" +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: true,\n' +
        "  code: 'OCR_DERIVED_PATH_INVALID',\n" +
        "  message: 'Caminho derivado de OCR inválido.',\n" +
        '  versionId: val.versionId,\n' +
        '  documentId: val.documentId,\n' +
        '  requestId: val.requestId,\n' +
        "  ocrStatus: 'FAILED',\n" +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: true, code: 'OCR_DERIVED_PATH_INVALID', message: 'Caminho derivado de OCR inválido.', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333', ocrStatus: 'FAILED' }],
});

const escreverPdfDerivado = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: {
    name: 'Escrever PDF derivado',
    parameters: {
      operation: 'write',
      fileName: expr("{{ $json.derivedPath }}"),
      dataPropertyName: 'data',
      options: {},
    },
  },
  output: [{ derivedPath: '/home/node/files/documents/a/b.ocr.11111111.pdf' }],
});

const atualizarVersaoSucesso = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar versão sucesso OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_derived_file_name = '{{ $json.derivedFileName }}',\n" +
        "    ocr_derived_file_path = '{{ $json.derivedPath }}',\n" +
        '    ocr_derived_checksum = NULLIF(\'{{ $json.checksum || "" }}\', \'\'),\n' +
        "    ocr_status = 'SUCCESS',\n" +
        '    ocr_finished_at = NOW(),\n' +
        '    ocr_duration_ms = NULLIF(\'{{ $json.durationMs || "" }}\', \'\')::int\n' +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222' }],
});

const extrairTextoPdfDerivado = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Extrair texto PDF derivado',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      url: 'http://tika:9998/tika',
      method: 'PUT',
      options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } },
      sendBody: true,
      contentType: 'binaryData',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Accept', value: 'text/plain' }] },
      inputDataFieldName: 'data',
    },
  },
  output: [{ statusCode: 200, data: 'texto extraído do pdf com ocr' }],
});

const avaliarTextoPosOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar texto pós-OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const upd = $('Atualizar versão sucesso OCR').first().json;\n" +
        "const val = $('Validar OCR').first().json;\n" +
        'const tika = $input.first().json || {};\n' +
        'let data = tika.data ?? tika.body ?? tika;\n' +
        "if (data && typeof data === 'object' && data.data != null && typeof data.data === 'string') data = data.data;\n" +
        "const text = typeof data === 'string' ? data : (data == null ? '' : String(data));\n" +
        'const textLength = text.length;\n' +
        'const minChars = Number(val.minChars || 80);\n' +
        'const thin = textLength < minChars;\n' +
        '\n' +
        'return [{ json: {\n' +
        '  ok: !thin,\n' +
        '  needOcr: true,\n' +
        '  extractedText: text,\n' +
        '  textLength,\n' +
        "  extractionMethod: 'ocr',\n" +
        "  ocrStatus: thin ? 'MANUAL_REVIEW' : 'SUCCESS',\n" +
        '  versionId: upd.versionId || val.versionId,\n' +
        '  documentId: upd.documentId || val.documentId,\n' +
        '  requestId: val.requestId,\n' +
        '  userId: val.userId,\n' +
        '  sessionId: val.sessionId,\n' +
        '  ocrEngine: val.engine,\n' +
        '  ocrLanguages: val.languages,\n' +
        '  ocrDurationMs: val.durationMs,\n' +
        '  ocrAttempts: val.ocrAttempts,\n' +
        "  code: thin ? 'OCR_MANUAL_REVIEW' : null,\n" +
        '} }];',
    },
  },
  output: [{ ok: true, needOcr: true, extractedText: 'texto extraído do pdf com ocr', textLength: 400, extractionMethod: 'ocr', ocrStatus: 'SUCCESS', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333', userId: '44444444-4444-4444-4444-444444444444', sessionId: '55555555-5555-5555-5555-555555555555', ocrEngine: 'ocrmypdf+tesseract', ocrLanguages: 'por+eng', ocrDurationMs: 4200, ocrAttempts: 1, code: null }],
});

const textoSuficiente = ifElse({
  version: 2.3,
  config: {
    name: 'Texto pós-OCR suficiente?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.ocrStatus }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'SUCCESS' }],
        combinator: 'and',
      },
    },
  },
});

const auditoriaOcrSucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria OCR sucesso',
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
          requestId: expr('{{ $json.requestId }}'),
          userId: expr('{{ $json.userId }}'),
          sessionId: expr('{{ $json.sessionId }}'),
          action: 'OCR_SUCCESS',
          resourceType: 'document_version',
          resourceId: expr('{{ $json.versionId }}'),
          success: true,
          metadata: expr('{{ { versionId: $json.versionId, durationMs: $json.ocrDurationMs, engine: $json.ocrEngine, languages: $json.ocrLanguages, attempts: $json.ocrAttempts, textLength: $json.textLength } }}'),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoSucesso = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno sucesso OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const av = $('Avaliar texto pós-OCR').first().json;\n" +
        'return [{ json: {\n' +
        '  ok: true,\n' +
        '  needOcr: true,\n' +
        '  extractedText: av.extractedText,\n' +
        '  textLength: av.textLength,\n' +
        '  extractionMethod: av.extractionMethod,\n' +
        '  ocrStatus: av.ocrStatus,\n' +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: true, needOcr: true, extractedText: 'texto extraído do pdf com ocr', textLength: 400, extractionMethod: 'ocr', ocrStatus: 'SUCCESS', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

const marcarRevisaoManualPosOcr = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar revisão manual pós-OCR',
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'UPDATE document_versions\n' +
        "SET ocr_status = 'MANUAL_REVIEW'\n" +
        "WHERE id = '{{ $json.versionId }}'::uuid\n" +
        'RETURNING id AS "versionId", document_id AS "documentId";'
      ),
    },
    credentials: { postgres: PG_CRED },
  },
  output: [{ versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222' }],
});

const auditoriaRevisaoManualPosOcr = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria revisão manual pós-OCR',
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
          requestId: expr("{{ $('Avaliar texto pós-OCR').first().json.requestId }}"),
          userId: expr("{{ $('Avaliar texto pós-OCR').first().json.userId }}"),
          sessionId: expr("{{ $('Avaliar texto pós-OCR').first().json.sessionId }}"),
          action: 'OCR_MANUAL_REVIEW',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Avaliar texto pós-OCR').first().json.versionId }}"),
          success: false,
          errorCode: 'OCR_MANUAL_REVIEW',
          metadata: expr("{{ { versionId: $('Avaliar texto pós-OCR').first().json.versionId, textLength: $('Avaliar texto pós-OCR').first().json.textLength, attempts: $('Avaliar texto pós-OCR').first().json.ocrAttempts } }}"),
        },
      },
    },
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoRevisaoManualPosOcr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno revisão manual pós-OCR',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const av = $('Avaliar texto pós-OCR').first().json;\n" +
        'return [{ json: {\n' +
        '  ok: false,\n' +
        '  needOcr: true,\n' +
        "  code: 'OCR_MANUAL_REVIEW',\n" +
        "  message: 'Texto extraído após OCR ainda insuficiente. Revisão manual necessária.',\n" +
        "  ocrStatus: 'MANUAL_REVIEW',\n" +
        '  versionId: av.versionId,\n' +
        '  documentId: av.documentId,\n' +
        '  requestId: av.requestId,\n' +
        '} }];',
    },
  },
  output: [{ ok: false, needOcr: true, code: 'OCR_MANUAL_REVIEW', message: 'Texto extraído após OCR ainda insuficiente. Revisão manual necessária.', ocrStatus: 'MANUAL_REVIEW', versionId: '11111111-1111-1111-1111-111111111111', documentId: '22222222-2222-2222-2222-222222222222', requestId: '33333333-3333-3333-3333-333333333333' }],
});

export default workflow('ocr-orquestrar', 'OCR - ORQUESTRAR')
  .add(ocrTrigger)
  .to(carregarVersao)
  .to(avaliarNode)
  .to(rotearAvaliacao
    .onCase(0, marcarOcrIniciado
      .to(auditoriaRequeridoOuRetry)
      .to(auditoriaOcrIniciado)
      .to(validarCaminhoOriginal)
      .to(caminhoOriginalSeguro
        .onTrue(lerArquivoOriginal
          .to(chamarServicoOcr)
          .to(validarOcr)
          .to(ocrValido
            .onTrue(prepararCaminhoDerivado
              .to(caminhoDerivadoSeguro
                .onTrue(escreverPdfDerivado
                  .to(atualizarVersaoSucesso)
                  .to(extrairTextoPdfDerivado)
                  .to(avaliarTextoPosOcr)
                  .to(textoSuficiente
                    .onTrue(auditoriaOcrSucesso.to(montarRetornoSucesso))
                    .onFalse(marcarRevisaoManualPosOcr.to(auditoriaRevisaoManualPosOcr).to(montarRetornoRevisaoManualPosOcr))
                  )
                )
                .onFalse(marcarFalhaCaminhoDerivado.to(auditoriaFalhaCaminhoDerivado).to(montarRetornoFalhaCaminhoDerivado))
              )
            )
            .onFalse(marcarOcrFalhado.to(auditoriaOcrFalhado).to(montarRetornoFalhaOcr))
          )
        )
        .onFalse(marcarFalhaCaminhoOriginal.to(auditoriaFalhaCaminhoOriginal).to(montarRetornoFalhaCaminho))
      )
    )
    .onCase(1, atualizarExtracaoLeve.to(montarRetornoSemOcr))
    .onCase(2, marcarRevisaoManual.to(auditoriaRevisaoManual).to(montarRetornoRevisaoManual))
    .onCase(3, montarRetornoBloqueado)
  );
