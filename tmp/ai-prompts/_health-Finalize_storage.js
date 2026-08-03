const prep = $('Prepare checks').first().json || {};
const writeItem = $('Write probe').first() || { json: {} };
const readItem = $('Read probe').first() || { json: {}, binary: {} };
const writeJson = writeItem.json || {};
const readJson = readItem.json || {};
const writeFailed = writeJson.error != null || writeJson.message != null;
const readFailed = readJson.error != null || readJson.message != null;
let storageAvailable = false;
if (!writeFailed && !readFailed) {
  if (readItem.binary && readItem.binary.data) storageAvailable = true;
  else if (readJson.fileName || readJson.mimeType) storageAvailable = true;
  else if (Object.keys(readJson).length > 0 && !readJson.error) storageAvailable = true;
}
const storageStartedAtMs = Number(prep.storageStartedAtMs || Date.now());
const durationMs = Math.max(0, Date.now() - storageStartedAtMs);
const partial = { ...(prep._partial || {}) };
partial.storage = {
  status: storageAvailable ? 'ok' : 'down',
  durationMs,
  storageAvailable,
};
return [{
  json: {
    mode: prep.mode || 'detailed',
    _partial: partial,
    tikaStartedAtMs: Date.now(),
  },
}];