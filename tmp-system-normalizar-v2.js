const crypto = require('crypto');
const inputItem = $input.first();
const item = inputItem.json || {};
const headers = item.headers || {};
const incoming = String(
  headers['x-request-id'] || headers['X-Request-Id'] || item.requestId || ''
).trim();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestId = uuidRe.test(incoming) ? incoming : crypto.randomUUID();
const now = Date.now();
const authorization = String(
  headers.authorization || headers.Authorization || item.authorization || ''
);
const method = String(item.method || '').toUpperCase() || null;
const path = String(item.path || item.url || '') || null;

const out = {
  requestId,
  requestStartedAt: new Date(now).toISOString(),
  requestStartedAtMs: now,
  method,
  path,
  headers,
  body: item.body || {},
  query: item.query || {},
  params: item.params || {},
  authorization,
};

if (item.webhookUrl) out.webhookUrl = item.webhookUrl;
if (item.executionMode) out.executionMode = item.executionMode;

const result = { json: out };
if (inputItem.binary) result.binary = inputItem.binary;
return [result];
