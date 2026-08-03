const prep = $('Aplicar Tika').first() || $('Validar e normalizar').first();
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
  json.message = 'Arquivo duplicado já existe neste documento.';
  json.validationStatus = 'VALID';
  json.validationErrorCode = null;
}

delete json._skipFurther;
delete json.maxUploadSizeBytes;
delete json.binaryPropertyName;
delete json.requestId;

return [{ json, binary }];