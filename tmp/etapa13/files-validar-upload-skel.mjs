import { workflow, node, trigger, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const triggerNode = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'documentId', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'binaryPropertyName', type: 'string' },
          { name: 'originalFileName', type: 'string' },
          { name: 'browserMimeType', type: 'string' },
          { name: 'fileSizeBytes', type: 'number' },
        ],
      },
    },
  },
});

const carregarPolitica = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar política',
    credentials: { postgres: newCredential('Postgres account') },
    parameters: {
      operation: 'executeQuery',
      query: "SELECT\n  COALESCE((SELECT value FROM app_secrets WHERE key = 'max_upload_size_bytes' LIMIT 1), '26214400') AS max_upload_size_bytes,\n  COALESCE((SELECT value FROM app_secrets WHERE key = 'allowed_file_extensions' LIMIT 1), 'pdf,doc,docx,xls,xlsx,csv,txt') AS allowed_file_extensions,\n  COALESCE((SELECT value FROM app_secrets WHERE key = 'allowed_mime_types' LIMIT 1), 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/csv') AS allowed_mime_types;",
      options: {},
    },
  },
});

const validarNormalizar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar e normalizar',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "return [{ json: { ok: false, statusCode: 500, code: 'FILE_UNREADABLE', message: 'stub', validationStatus: 'INVALID', validationErrorCode: 'FILE_UNREADABLE', duplicateSameDocument: false, duplicateOtherDocument: false, otherDocumentId: null, pageCount: null, checksumAlgorithm: 'SHA-256' } }];",
    },
  },
});

const basicoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Básico ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'ok1',
            leftValue: expr('{{ $json.ok }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
      },
      looseTypeValidation: true,
    },
  },
});

const detectarTika = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Detectar MIME Tika',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'PUT',
      url: 'http://tika:9998/detect/stream',
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Accept', value: 'text/plain' }],
      },
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: expr("{{ $json.binaryPropertyName || 'file0' }}"),
      options: {
        timeout: 15000,
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'text',
          },
        },
      },
    },
  },
});

const aplicarTika = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Aplicar Tika',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const base = $('Validar e normalizar').first(); return [{ json: base.json, binary: base.binary }];",
    },
  },
});

const tikaOk = ifElse({
  version: 2.3,
  config: {
    name: 'Tika ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'ok2',
            leftValue: expr('{{ $json.ok }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
      },
      looseTypeValidation: true,
    },
  },
});

const checarDuplicatas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Checar duplicatas',
    credentials: { postgres: newCredential('Postgres account') },
    parameters: {
      operation: 'executeQuery',
      query: "SELECT\n  EXISTS(\n    SELECT 1\n    FROM document_versions dv\n    WHERE dv.document_id = '{{ $('Aplicar Tika').first().json.documentId }}'::uuid\n      AND dv.checksum = '{{ $('Aplicar Tika').first().json.checksum }}'\n      AND dv.file_size = {{ Number($('Aplicar Tika').first().json.fileSize) }}\n  ) AS duplicate_same_document,\n  (\n    SELECT dv.document_id::text\n    FROM document_versions dv\n    WHERE dv.checksum = '{{ $('Aplicar Tika').first().json.checksum }}'\n      AND dv.document_id <> '{{ $('Aplicar Tika').first().json.documentId }}'::uuid\n    LIMIT 1\n  ) AS other_document_id;",
      options: {},
    },
  },
});

const finalizar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalizar validação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const prep = $('Aplicar Tika').first(); const json = { ...(prep.json || {}) }; const dup = $input.first().json || {}; json.duplicateSameDocument = dup.duplicate_same_document === true || dup.duplicate_same_document === 't' || dup.duplicate_same_document === 'true'; json.duplicateOtherDocument = !!dup.other_document_id; json.otherDocumentId = dup.other_document_id ? String(dup.other_document_id) : null; if (json.duplicateSameDocument) { json.statusCode = 409; json.code = 'DUPLICATE_FILE'; json.message = 'Arquivo duplicado já existe neste documento.'; } delete json._skipFurther; delete json.maxUploadSizeBytes; delete json.binaryPropertyName; delete json.requestId; return [{ json, binary: prep.binary }];",
    },
  },
});

const passarInvalido = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Passar inválido',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const item = $input.first(); const json = { ...(item.json || {}) }; delete json._skipFurther; delete json.maxUploadSizeBytes; delete json.binaryPropertyName; delete json.requestId; return [{ json, binary: item.binary }];",
    },
  },
});

export default workflow('files-validar-upload', 'FILES - VALIDAR UPLOAD')
  .add(triggerNode)
  .to(carregarPolitica)
  .to(validarNormalizar)
  .to(
    basicoOk
      .onTrue(
        detectarTika
          .to(aplicarTika)
          .to(
            tikaOk
              .onTrue(checarDuplicatas.to(finalizar))
              .onFalse(passarInvalido),
          ),
      )
      .onFalse(passarInvalido),
  );
