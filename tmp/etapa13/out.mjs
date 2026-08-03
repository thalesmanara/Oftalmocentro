import { workflow, node, trigger, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const VALIDAR_JS = String.raw`const crypto = require('crypto');

const MESSAGES = {
  FILE_REQUIRED: 'Arquivo ├® obrigat├│rio.',
  FILE_EMPTY: 'Arquivo est├í vazio.',
  FILE_TOO_LARGE: 'Arquivo excede o tamanho m├íximo permitido.',
  INVALID_FILE_NAME: 'Nome de arquivo inv├ílido.',
  FILE_EXTENSION_NOT_ALLOWED: 'Extens├úo de arquivo n├úo permitida.',
  FILE_EXTENSION_MISMATCH: 'Extens├úo de arquivo inconsistente ou suspeita.',
  FILE_TYPE_NOT_ALLOWED: 'Tipo de arquivo n├úo permitido.',
  FILE_MIME_MISMATCH: 'Tipo MIME detectado n├úo corresponde ├á extens├úo.',
  FILE_PASSWORD_PROTECTED: 'Arquivo protegido por senha.',
  FILE_CORRUPTED: 'Arquivo corrompido ou ileg├¡vel.',
  FILE_UNREADABLE: 'Arquivo ileg├¡vel.',
  DUPLICATE_FILE: 'Arquivo duplicado j├í existe neste documento.',
};

const DANGEROUS_EXTS = new Set(['exe','js','html','htm','bat','cmd','ps1','php','jar','msi','scr','com','vbs','dll','sh','msi']);
const RESERVED = new Set(['CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9']);

const triggerItem = $('Trigger').first();
const triggerJson = triggerItem.json || {};
const policyRow = $input.first().json || {};

const documentId = String(triggerJson.documentId || '').trim();
const requestId = String(triggerJson.requestId || '').trim();
const preferredKey = String(triggerJson.binaryPropertyName || 'file0').trim() || 'file0';
const browserMimeHint = String(triggerJson.browserMimeType || '').trim();
const originalHint = String(triggerJson.originalFileName || '').trim();

const defaults = {
  maxUploadSizeBytes: 26214400,
  allowedExtensions: ['pdf','doc','docx','xls','xlsx','csv','txt'],
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/csv',
  ],
};

const maxUploadSizeBytes = Number(policyRow.max_upload_size_bytes || defaults.maxUploadSizeBytes) || defaults.maxUploadSizeBytes;
const allowedExtensions = String(policyRow.allowed_file_extensions || defaults.allowedExtensions.join(','))
  .split(',')
  .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
  .filter(Boolean);
const allowedMimeTypes = String(policyRow.allowed_mime_types || defaults.allowedMimeTypes.join(','))
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function fail(code, statusCode, partial) {
  const out = {
    ok: false,
    statusCode: statusCode || 400,
    code,
    message: MESSAGES[code] || 'Valida├º├úo de arquivo falhou.',
    documentId: documentId || null,
    originalFileName: partial?.originalFileName ?? (originalHint || null),
    originalFileNameSanitized: partial?.originalFileNameSanitized ?? null,
    storedFileName: null,
    fileExtension: partial?.fileExtension ?? null,
    browserMimeType: partial?.browserMimeType ?? (browserMimeHint || null),
    detectedMimeType: partial?.detectedMimeType ?? null,
    fileSize: partial?.fileSize ?? null,
    checksum: partial?.checksum ?? null,
    checksumAlgorithm: 'SHA-256',
    validationStatus: 'INVALID',
    validationErrorCode: code,
    duplicateSameDocument: false,
    duplicateOtherDocument: false,
    otherDocumentId: null,
    pageCount: null,
    binaryPropertyName: preferredKey,
    _skipFurther: true,
  };
  const binary = triggerItem.binary || undefined;
  return [{ json: out, binary }];
}

const binary = triggerItem.binary || {};
const keys = Object.keys(binary);
let binKey = null;
if (binary[preferredKey]) binKey = preferredKey;
else if (binary.file0) binKey = 'file0';
else if (binary.file) binKey = 'file';
else if (binary.data) binKey = 'data';
else if (keys.length) binKey = keys[0];

if (!binKey || !binary[binKey]) {
  return fail('FILE_REQUIRED', 400);
}

const bin = binary[binKey];
const browserMimeType = String(browserMimeHint || bin.mimeType || '').trim() || null;
let originalFileName = String(originalHint || bin.fileName || '').trim();
if (!originalFileName) originalFileName = 'upload.bin';

let buf;
try {
  const data = bin.data;
  if (Buffer.isBuffer(data)) buf = data;
  else if (typeof data === 'string') buf = Buffer.from(data, 'base64');
  else return fail('FILE_UNREADABLE', 400, { originalFileName, browserMimeType });
} catch (_) {
  return fail('FILE_UNREADABLE', 400, { originalFileName, browserMimeType });
}

const fileSize = buf.length;
if (fileSize === 0) {
  return fail('FILE_EMPTY', 400, { originalFileName, browserMimeType, fileSize: 0 });
}
if (fileSize > maxUploadSizeBytes) {
  return fail('FILE_TOO_LARGE', 413, { originalFileName, browserMimeType, fileSize });
}

let sanitized = originalFileName
  .replace(/\\/g, '/')
  .split('/')
  .pop() || '';
sanitized = sanitized.replace(/\0/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim();
sanitized = sanitized.replace(/\.\.+/g, '.');
if (sanitized.length > 200) sanitized = sanitized.slice(0, 200);
sanitized = sanitized.trim();
if (!sanitized) {
  return fail('INVALID_FILE_NAME', 400, { originalFileName, browserMimeType, fileSize });
}
const baseNoExt = sanitized.replace(/\.[^.]+$/g, '');
if (RESERVED.has(baseNoExt.toUpperCase()) || RESERVED.has(sanitized.toUpperCase())) {
  return fail('INVALID_FILE_NAME', 400, { originalFileName, originalFileNameSanitized: sanitized, browserMimeType, fileSize });
}

const lowerName = sanitized.toLowerCase();
const parts = lowerName.split('.').filter(Boolean);
if (parts.length < 2) {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, browserMimeType, fileSize });
}
const ext = parts[parts.length - 1];
const prevExt = parts.length >= 3 ? parts[parts.length - 2] : null;

if (DANGEROUS_EXTS.has(ext)) {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (prevExt && (DANGEROUS_EXTS.has(prevExt) || (allowedExtensions.includes(prevExt) && DANGEROUS_EXTS.has(ext)))) {
  return fail('FILE_EXTENSION_MISMATCH', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (prevExt && allowedExtensions.includes(prevExt) && ext !== prevExt && ['exe','js','html','bat','cmd','ps1','php','jar'].includes(ext)) {
  return fail('FILE_EXTENSION_MISMATCH', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (!allowedExtensions.includes(ext)) {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (ext === 'zip') {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}

function detectMagic(buffer, extension) {
  if (buffer.length >= 4) {
    const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];
    if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
      return { mime: 'application/pdf', kind: 'pdf' };
    }
    if (b0 === 0xd0 && b1 === 0xcf && b2 === 0x11 && b3 === 0xe0) {
      if (extension === 'xls') return { mime: 'application/vnd.ms-excel', kind: 'ole' };
      return { mime: 'application/msword', kind: 'ole' };
    }
    if (b0 === 0x50 && b1 === 0x4b) {
      return { mime: 'zip', kind: 'zip' };
    }
  }
  const sample = buffer.slice(0, Math.min(buffer.length, 4096));
  let printable = 0;
  let weird = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || c >= 128) printable++;
    else weird++;
  }
  const ratio = sample.length ? printable / sample.length : 0;
  if (ratio >= 0.85 && weird / Math.max(sample.length, 1) < 0.15) {
    if (extension === 'csv') return { mime: 'text/csv', kind: 'text' };
    return { mime: 'text/plain', kind: 'text' };
  }
  return { mime: null, kind: 'unknown' };
}

const magic = detectMagic(buf, ext);
let detectedMimeType = null;
let mimeMismatch = false;

if (magic.kind === 'pdf') {
  detectedMimeType = 'application/pdf';
  if (ext !== 'pdf') mimeMismatch = true;
} else if (magic.kind === 'ole') {
  if (ext === 'doc') detectedMimeType = 'application/msword';
  else if (ext === 'xls') detectedMimeType = 'application/vnd.ms-excel';
  else mimeMismatch = true;
} else if (magic.kind === 'zip') {
  if (ext === 'docx') detectedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (ext === 'xlsx') detectedMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  else mimeMismatch = true;
} else if (magic.kind === 'text') {
  if (ext === 'txt') detectedMimeType = 'text/plain';
  else if (ext === 'csv') detectedMimeType = 'text/csv';
  else if (['pdf','doc','docx','xls','xlsx'].includes(ext)) mimeMismatch = true;
  else detectedMimeType = magic.mime;
} else {
  if (['pdf','doc','docx','xls','xlsx'].includes(ext)) {
    return fail('FILE_MIME_MISMATCH', 400, {
      originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize,
    });
  }
  if (ext === 'txt') detectedMimeType = 'text/plain';
  else if (ext === 'csv') detectedMimeType = 'text/csv';
}

if (mimeMismatch) {
  return fail('FILE_MIME_MISMATCH', 400, {
    originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, detectedMimeType, fileSize,
  });
}

if (detectedMimeType && allowedMimeTypes.length && !allowedMimeTypes.includes(detectedMimeType.toLowerCase())) {
  if (!(detectedMimeType === 'text/csv' && allowedMimeTypes.includes('application/csv')) &&
      !(detectedMimeType === 'application/csv' && allowedMimeTypes.includes('text/csv'))) {
    return fail('FILE_TYPE_NOT_ALLOWED', 400, {
      originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, detectedMimeType, fileSize,
    });
  }
}

const checksum = crypto.createHash('sha256').update(buf).digest('hex');
const storedFileName = crypto.randomUUID() + '.' + ext;

const outBinary = {};
outBinary[binKey] = bin;
if (binKey !== 'file0') outBinary.file0 = bin;

return [{
  json: {
    ok: true,
    statusCode: 200,
    code: null,
    message: null,
    documentId,
    requestId,
    originalFileName,
    originalFileNameSanitized: sanitized,
    storedFileName,
    fileExtension: ext,
    browserMimeType,
    detectedMimeType,
    fileSize,
    checksum,
    checksumAlgorithm: 'SHA-256',
    validationStatus: 'VALID',
    validationErrorCode: null,
    duplicateSameDocument: false,
    duplicateOtherDocument: false,
    otherDocumentId: null,
    pageCount: null,
    binaryPropertyName: binKey,
    maxUploadSizeBytes,
    _skipFurther: false,
  },
  binary: outBinary,
}];`;

const APLICAR_TIKA_JS = String.raw`const base = $('Validar e normalizar').first();
const baseJson = { ...(base.json || {}) };
const binary = base.binary;

if (baseJson._skipFurther || baseJson.ok === false) {
  return [{ json: baseJson, binary }];
}

const tika = $input.first().json || {};
const statusCode = Number(tika.statusCode ?? tika.status ?? 0);
let body = tika.data ?? tika.body ?? tika;
if (body && typeof body === 'object' && body.data != null) body = body.data;
const text = String(typeof body === 'string' ? body : (body?.toString?.() || '')).trim();
const lower = text.toLowerCase();

if (/password|encrypted|encryption/i.test(lower) || /password|encrypted/i.test(JSON.stringify(tika).slice(0, 500))) {
  return [{
    json: {
      ...baseJson,
      ok: false,
      statusCode: 400,
      code: 'FILE_PASSWORD_PROTECTED',
      message: 'Arquivo protegido por senha.',
      validationStatus: 'INVALID',
      validationErrorCode: 'FILE_PASSWORD_PROTECTED',
      _skipFurther: true,
    },
    binary,
  }];
}

if (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400 && text) {
  const mime = text.split(';')[0].trim().toLowerCase();
  if (mime && mime.includes('/')) {
    const mapped = mime === 'application/x-tika-ooxml'
      ? (baseJson.fileExtension === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      : mime === 'application/x-tika-msoffice'
        ? (baseJson.fileExtension === 'xls' ? 'application/vnd.ms-excel' : 'application/msword')
        : mime;

    if (/encrypted|password/i.test(mapped)) {
      return [{
        json: {
          ...baseJson,
          ok: false,
          statusCode: 400,
          code: 'FILE_PASSWORD_PROTECTED',
          message: 'Arquivo protegido por senha.',
          validationStatus: 'INVALID',
          validationErrorCode: 'FILE_PASSWORD_PROTECTED',
          detectedMimeType: mapped,
          _skipFurther: true,
        },
        binary,
      }];
    }

    const ext = baseJson.fileExtension;
    const conflicts =
      (mapped === 'application/pdf' && ext !== 'pdf') ||
      (mapped.includes('wordprocessingml') && ext !== 'docx') ||
      (mapped.includes('spreadsheetml') && ext !== 'xlsx') ||
      (mapped === 'application/msword' && !['doc','xls'].includes(ext) && ext !== 'doc') ||
      (mapped === 'application/vnd.ms-excel' && ext !== 'xls');

    if (conflicts && baseJson.detectedMimeType && mapped !== baseJson.detectedMimeType) {
      const strongConflict =
        (baseJson.detectedMimeType === 'application/pdf' && !mapped.includes('pdf')) ||
        (mapped === 'application/pdf' && baseJson.detectedMimeType !== 'application/pdf');
      if (strongConflict) {
        return [{
          json: {
            ...baseJson,
            ok: false,
            statusCode: 400,
            code: 'FILE_MIME_MISMATCH',
            message: 'Tipo MIME detectado n├úo corresponde ├á extens├úo.',
            validationStatus: 'INVALID',
            validationErrorCode: 'FILE_MIME_MISMATCH',
            detectedMimeType: mapped,
            _skipFurther: true,
          },
          binary,
        }];
      }
    }

    baseJson.detectedMimeType = mapped || baseJson.detectedMimeType;
  }
}

return [{ json: baseJson, binary }];`;

const FINALIZAR_JS = String.raw`const prep = $('Aplicar Tika').first() || $('Validar e normalizar').first();
let json = { ...(prep.json || {}) };
const binary = prep.binary;

if (json._skipFurther || json.ok === false) {
  delete json._skipFurther;
  delete json.maxUploadSizeBytes;
  delete json.binaryPropertyName;
  delete json.requestId;
  return [{ json, binary }];
}

const dup = $input.first().json || {};
const same = dup.duplicate_same_document === true || dup.duplicate_same_document === 't' || dup.duplicate_same_document === 'true';
const otherId = dup.other_document_id ? String(dup.other_document_id) : null;

json.duplicateSameDocument = !!same;
json.duplicateOtherDocument = !!otherId;
json.otherDocumentId = otherId;

if (same) {
  json.ok = true;
  json.statusCode = 409;
  json.code = 'DUPLICATE_FILE';
  json.message = 'Arquivo duplicado j├í existe neste documento.';
  json.validationStatus = 'VALID';
  json.validationErrorCode = null;
}

delete json._skipFurther;
delete json.maxUploadSizeBytes;
delete json.binaryPropertyName;
delete json.requestId;

return [{ json, binary }];`;

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
    name: 'Carregar pol├¡tica',
    credentials: { postgres: newCredential('Postgres account') },
    parameters: {
      operation: 'executeQuery',
      query: `SELECT
  COALESCE((SELECT value FROM app_secrets WHERE key = 'max_upload_size_bytes' LIMIT 1), '26214400') AS max_upload_size_bytes,
  COALESCE((SELECT value FROM app_secrets WHERE key = 'allowed_file_extensions' LIMIT 1), 'pdf,doc,docx,xls,xlsx,csv,txt') AS allowed_file_extensions,
  COALESCE((SELECT value FROM app_secrets WHERE key = 'allowed_mime_types' LIMIT 1), 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/csv') AS allowed_mime_types;`,
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
      jsCode: VALIDAR_JS,
    },
  },
});

const basicoOk = ifElse({
  version: 2.3,
  config: {
    name: 'B├ísico ok?',
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
      jsCode: APLICAR_TIKA_JS,
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
      query: `SELECT
  EXISTS(
    SELECT 1
    FROM document_versions dv
    WHERE dv.document_id = '{{ $('Aplicar Tika').first().json.documentId }}'::uuid
      AND dv.checksum = '{{ $('Aplicar Tika').first().json.checksum }}'
      AND dv.file_size = {{ Number($('Aplicar Tika').first().json.fileSize) }}
  ) AS duplicate_same_document,
  (
    SELECT dv.document_id::text
    FROM document_versions dv
    WHERE dv.checksum = '{{ $('Aplicar Tika').first().json.checksum }}'
      AND dv.document_id <> '{{ $('Aplicar Tika').first().json.documentId }}'::uuid
    LIMIT 1
  ) AS other_document_id;`,
      options: {},
    },
  },
});

const finalizar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalizar valida├º├úo',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: FINALIZAR_JS,
    },
  },
});

const passarInvalido = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Passar inv├ílido',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first();
const json = { ...(item.json || {}) };
delete json._skipFurther;
delete json.maxUploadSizeBytes;
delete json.binaryPropertyName;
delete json.requestId;
return [{ json, binary: item.binary }];`,
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

