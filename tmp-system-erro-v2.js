const crypto = require('crypto');
const item = $input.first().json || {};
const rawCode = String(
  item.code || (item.error && item.error.code) || 'INTERNAL_ERROR'
).toUpperCase();
const code = rawCode.replace(/[^A-Z0-9_]/g, '_') || 'INTERNAL_ERROR';
let message = String(
  item.message || (item.error && item.error.message) || 'Ocorreu um erro inesperado.'
);
const banned = [
  /password_hash/i,
  /stack trace/i,
  /postgres/i,
  /\bsql\b/i,
  /node_/i,
  /\/var\//i,
  /\bpg_/i,
  /constraint/i,
  /duplicate key/i,
  /jwt_hs256/i,
  /gen_salt/i,
];
if (banned.some((re) => re.test(message))) {
  message =
    code === 'USER_EMAIL_ALREADY_EXISTS'
      ? 'Já existe um usuário com este e-mail.'
      : 'Ocorreu um erro inesperado.';
}
const fields =
  item.fields && typeof item.fields === 'object' && !Array.isArray(item.fields)
    ? item.fields
    : undefined;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const incoming = String(item.requestId || '').trim();
const requestId = uuidRe.test(incoming) ? incoming : crypto.randomUUID();
const startedMs = Number(item.requestStartedAtMs);
const hasStart = Number.isFinite(startedMs) && startedMs > 0;
const durationMs = hasStart ? Math.max(0, Date.now() - startedMs) : 0;
let statusCode = Number(item.statusCode || (item.error && item.error.statusCode) || 500);
if (!Number.isFinite(statusCode) || statusCode < 400 || statusCode > 599) statusCode = 500;
const timestamp = new Date().toISOString();
const error = { code, message };
if (fields && Object.keys(fields).length > 0) error.fields = fields;
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
  success: false,
  statusCode,
  errorCode: code,
};
return [
  {
    json: {
      statusCode,
      requestId,
      durationMs,
      response: {
        success: false,
        error,
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
