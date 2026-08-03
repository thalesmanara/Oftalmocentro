const crypto = require('crypto');

const MESSAGES = {
  FILE_REQUIRED: 'Arquivo é obrigatório.',
  FILE_EMPTY: 'Arquivo está vazio.',
  FILE_TOO_LARGE: 'Arquivo excede o tamanho máximo permitido.',
  INVALID_FILE_NAME: 'Nome de arquivo inválido.',
  FILE_EXTENSION_NOT_ALLOWED: 'Extensão de arquivo não permitida.',
  FILE_EXTENSION_MISMATCH: 'Extensão de arquivo inconsistente ou suspeita.',
  FILE_TYPE_NOT_ALLOWED: 'Tipo de arquivo não permitido.',
  FILE_MIME_MISMATCH: 'Tipo MIME detectado não corresponde à extensão.',
  FILE_PASSWORD_PROTECTED: 'Arquivo protegido por senha.',
  FILE_CORRUPTED: 'Arquivo corrompido ou ilegível.',
  FILE_UNREADABLE: 'Arquivo ilegível.',
  DUPLICATE_FILE: 'Arquivo duplicado já existe neste documento.',
};

const DANGEROUS_EXTS = new Set(['exe','js','html','htm','bat','cmd','ps1','php','jar','msi','scr','com','vbs','dll','sh']);
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
    message: MESSAGES[code] || 'Validação de arquivo falhou.',
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
  return [{ json: out, binary: triggerItem.binary || undefined }];
}

function resolveMetaSize(binObj) {
  if (!binObj) return null;
  if (binObj.bytes != null && Number.isFinite(Number(binObj.bytes))) {
    return Number(binObj.bytes);
  }
  if (typeof binObj.fileSize === 'number' && Number.isFinite(binObj.fileSize)) {
    return binObj.fileSize;
  }
  if (typeof binObj.fileSize === 'string') {
    const raw = binObj.fileSize.trim();
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) return asNum;
    const m = raw.match(/^([\d.]+)\s*([kmg]?b)?$/i);
    if (m) {
      const v = Number(m[1]);
      const u = (m[2] || 'B').toUpperCase();
      const mult = u === 'KB' ? 1024 : u === 'MB' ? 1024 * 1024 : u === 'GB' ? 1024 * 1024 * 1024 : 1;
      if (Number.isFinite(v)) return Math.round(v * mult);
    }
  }
  return null;
}

async function loadBinaryBuffer(binKey, binObj) {
  const inputBin = $input.first()?.binary?.[binKey];
  if (inputBin && typeof this.helpers?.getBinaryDataBuffer === 'function') {
    return await this.helpers.getBinaryDataBuffer(0, binKey);
  }
  if (binObj?.id && typeof this.helpers?.getBinaryStream === 'function' && typeof this.helpers?.binaryToBuffer === 'function') {
    const stream = await this.helpers.getBinaryStream(binObj.id);
    return await this.helpers.binaryToBuffer(stream);
  }
  if (Buffer.isBuffer(binObj?.data)) {
    return binObj.data;
  }
  if (
    typeof binObj?.data === 'string' &&
    binObj.data.length > 0 &&
    !binObj.id &&
    binObj.data !== 'filesystem-v2' &&
    binObj.data !== 'filesystem'
  ) {
    return Buffer.from(binObj.data, 'base64');
  }
  throw new Error('FILE_UNREADABLE');
}

const binary = triggerItem.binary || $input.first().binary || {};
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

const metaSize = resolveMetaSize(bin);
if (metaSize === 0) {
  return fail('FILE_EMPTY', 400, { originalFileName, browserMimeType, fileSize: 0 });
}
if (metaSize != null && metaSize > maxUploadSizeBytes) {
  return fail('FILE_TOO_LARGE', 413, { originalFileName, browserMimeType, fileSize: metaSize });
}

let buf;
try {
  buf = await loadBinaryBuffer.call(this, binKey, bin);
} catch (err) {
  return fail('FILE_UNREADABLE', 400, { originalFileName, browserMimeType });
}

if (!Buffer.isBuffer(buf)) {
  return fail('FILE_UNREADABLE', 400, { originalFileName, browserMimeType });
}

const fileSize = buf.length;
if (fileSize === 0) {
  return fail('FILE_EMPTY', 400, { originalFileName, browserMimeType, fileSize: 0 });
}
if (fileSize > maxUploadSizeBytes) {
  return fail('FILE_TOO_LARGE', 413, { originalFileName, browserMimeType, fileSize });
}

let sanitized = originalFileName.replace(/\\/g, '/').split('/').pop() || '';
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

if (prevExt && allowedExtensions.includes(prevExt) && DANGEROUS_EXTS.has(ext)) {
  return fail('FILE_EXTENSION_MISMATCH', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (prevExt && DANGEROUS_EXTS.has(prevExt)) {
  return fail('FILE_EXTENSION_MISMATCH', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (DANGEROUS_EXTS.has(ext) || ext === 'zip') {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}
if (!allowedExtensions.includes(ext)) {
  return fail('FILE_EXTENSION_NOT_ALLOWED', 400, { originalFileName, originalFileNameSanitized: sanitized, fileExtension: ext, browserMimeType, fileSize });
}

function detectMagic(buffer, extension) {
  if (buffer.length >= 5) {
    const head = buffer.slice(0, 5).toString('latin1');
    if (head.startsWith('%PDF-') || head.startsWith('%PDF')) {
      return { mime: 'application/pdf', kind: 'pdf' };
    }
  }
  if (buffer.length >= 4) {
    const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];
    if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
      return { mime: 'application/pdf', kind: 'pdf' };
    }
    if (b0 === 0xd0 && b1 === 0xcf && b2 === 0x11 && b3 === 0xe0) {
      if (extension === 'xls') return { mime: 'application/vnd.ms-excel', kind: 'ole' };
      return { mime: 'application/msword', kind: 'ole' };
    }
    if (b0 === 0x50 && b1 === 0x4b && (b2 === 0x03 || b2 === 0x05 || b2 === 0x07) && (b3 === 0x04 || b3 === 0x06 || b3 === 0x08)) {
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
}];
