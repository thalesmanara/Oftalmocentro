const base = $('Validar e normalizar').first();
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
            message: 'Tipo MIME detectado não corresponde à extensão.',
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

return [{ json: baseJson, binary }];