const crypto = require('crypto');
const item = $input.first().json || {};
let data = item.data;
if (typeof data === 'undefined') {
  const all = $input.all().map((i) => i.json);
  data = item.asList === true ? all : all.length === 1 ? all[0] : all;
}
if (item.asList === true && !Array.isArray(data)) {
  data = data == null ? [] : [data];
}
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const incoming = String(item.requestId || '').trim();
const requestId = uuidRe.test(incoming) ? incoming : crypto.randomUUID();
const startedMs = Number(item.requestStartedAtMs);
const hasStart = Number.isFinite(startedMs) && startedMs > 0;
const durationMs = hasStart ? Math.max(0, Date.now() - startedMs) : 0;
let statusCode = Number(item.statusCode || 200);
if (!Number.isFinite(statusCode) || statusCode < 100 || statusCode > 599) statusCode = 200;
const timestamp = new Date().toISOString();
const userId = item.userId != null && item.userId !== '' ? String(item.userId) : null;
const sessionId =
  item.sessionId != null && item.sessionId !== '' ? String(item.sessionId) : null;
const tracking = {
  requestId,
  requestStartedAt: hasStart ? new Date(startedMs).toISOString() : timestamp,
  durationMs,
  userId,
  sessionId,
  method: item.method != null && item.method !== '' ? String(item.method) : null,
  path: item.path != null && item.path !== '' ? String(item.path) : null,
  success: true,
  statusCode,
  errorCode: null,
};
return [
  {
    json: {
      statusCode,
      requestId,
      durationMs,
      response: {
        success: true,
        data,
        meta: {
          requestId,
          timestamp,
          durationMs,
        },
      },
      responseHeaders: {
        'X-Request-Id': requestId,
        'X-Response-Time-Ms': String(durationMs),
      },
      tracking,
    },
  },
];
