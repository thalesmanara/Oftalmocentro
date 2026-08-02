const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_KEY_RE =
  /^(password|passwordhash|password_hash|passwd|token|accesstoken|access_token|refreshtoken|refresh_token|authorization|jwt|secret|jwtsecret|jwt_hs256_secret|hash|chunks?|chunktexts?|extractedtext|extracted_text|filecontent|file_content|binary|sql|stack|stacktrace|filepath|file_path|content|rawtext|raw_text|context|prompt|answer|question)$/i;

const MAX_JSON_CHARS = 12000;
const MAX_STRING = 2000;
const MAX_ARRAY = 40;
const MAX_DEPTH = 6;

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

function truncateString(s) {
  const str = String(s);
  if (str.length <= MAX_STRING) return str;
  return str.slice(0, MAX_STRING) + '…';
}

function looksSecret(str) {
  return /^\$2[aby]\$/.test(str) || /^eyJ[A-Za-z0-9_-]+\./.test(str) || /^Bearer\s+/i.test(str);
}

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[truncated]';
  if (typeof value === 'string') {
    if (looksSecret(value)) return '[redacted]';
    return truncateString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(k) || /password|token|secret|authorization|hash|chunk/i.test(k)) {
        continue;
      }
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return null;
}

function limitJson(value) {
  if (value == null) return null;
  const sanitized = sanitize(value);
  try {
    const raw = JSON.stringify(sanitized);
    if (raw.length <= MAX_JSON_CHARS) return sanitized;
    return {
      _truncated: true,
      preview: raw.slice(0, MAX_JSON_CHARS),
      originalChars: raw.length,
    };
  } catch {
    return { _error: 'unserializable' };
  }
}

function parseIp(headers, explicit) {
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    const first = explicit.split(',')[0].trim();
    if (/^[0-9a-fA-F:.]+$/.test(first)) return first;
  }
  const h = headers || {};
  const xf =
    h['x-forwarded-for'] ||
    h['X-Forwarded-For'] ||
    h['x-real-ip'] ||
    h['X-Real-Ip'] ||
    h['x-real-ip'] ||
    '';
  const raw = String(xf || '').trim();
  if (!raw) return null;
  const first = raw.split(',')[0].trim();
  if (!first || !/^[0-9a-fA-F:.]+$/.test(first)) return null;
  return first;
}

const inputItem = $input.first();
const item = inputItem.json || {};
const tracking = item.tracking && typeof item.tracking === 'object' ? item.tracking : {};
const headers = item.headers || {};

const requestIdRaw = String(item.requestId || tracking.requestId || '').trim();
const requestId = isUuid(requestIdRaw) ? requestIdRaw : null;

const action = String(item.action || '').trim().toUpperCase();
const resourceType = String(item.resourceType || item.resource_type || '').trim().toLowerCase();

const userIdRaw = item.userId != null && item.userId !== '' ? String(item.userId) : tracking.userId != null ? String(tracking.userId) : '';
const sessionIdRaw =
  item.sessionId != null && item.sessionId !== ''
    ? String(item.sessionId)
    : tracking.sessionId != null
      ? String(tracking.sessionId)
      : '';

const success =
  typeof item.success === 'boolean'
    ? item.success
    : typeof tracking.success === 'boolean'
      ? tracking.success
      : true;

let statusCode = Number(item.statusCode != null ? item.statusCode : tracking.statusCode);
if (!Number.isFinite(statusCode)) statusCode = null;

let durationMs = Number(item.durationMs != null ? item.durationMs : tracking.durationMs);
if (!Number.isFinite(durationMs) || durationMs < 0) durationMs = null;
else durationMs = Math.round(durationMs);

const method = String(item.method || tracking.method || '') || null;
const path = String(item.path || tracking.path || '') || null;
const errorCode =
  item.errorCode != null && item.errorCode !== ''
    ? String(item.errorCode)
    : tracking.errorCode != null && tracking.errorCode !== ''
      ? String(tracking.errorCode)
      : null;

let occurredAt = item.occurredAt || tracking.requestStartedAt || new Date().toISOString();
try {
  occurredAt = new Date(occurredAt).toISOString();
} catch {
  occurredAt = new Date().toISOString();
}

const resourceIdRaw =
  item.resourceId != null && item.resourceId !== ''
    ? String(item.resourceId)
    : item.entityId != null
      ? String(item.entityId)
      : '';

const ipAddress = parseIp(headers, item.ipAddress);
const userAgent = truncateString(
  String(item.userAgent || headers['user-agent'] || headers['User-Agent'] || '') || ''
) || null;

const beforeData = limitJson(item.beforeData === undefined ? null : item.beforeData);
const afterData = limitJson(item.afterData === undefined ? null : item.afterData);
const metadata = limitJson(item.metadata === undefined ? {} : item.metadata);

const skip = item.skipAudit === true;
const valid = !skip && !!requestId && !!action && !!resourceType;

const passthrough = {
  statusCode: item.statusCode,
  requestId: item.requestId || requestId,
  durationMs: item.durationMs != null ? item.durationMs : durationMs,
  response: item.response,
  responseHeaders: item.responseHeaders,
  tracking: item.tracking || tracking,
};

const result = {
  json: {
    ...passthrough,
    _auditInsert: valid
      ? {
          occurredAt,
          userId: isUuid(userIdRaw) ? userIdRaw : null,
          sessionId: isUuid(sessionIdRaw) ? sessionIdRaw : null,
          action,
          resourceType,
          resourceId: isUuid(resourceIdRaw) ? resourceIdRaw : null,
          success,
          requestId,
          method,
          path,
          statusCode,
          durationMs,
          ipAddress,
          userAgent,
          beforeData,
          afterData,
          metadata,
          errorCode,
          entity: resourceType,
          entityId: isUuid(resourceIdRaw) ? resourceIdRaw : null,
        }
      : null,
    audit: {
      attempted: valid,
      skipped: skip || !valid,
      reason: skip ? 'skipAudit' : !requestId ? 'invalid_requestId' : !action ? 'missing_action' : !resourceType ? 'missing_resourceType' : null,
    },
  },
};

if (inputItem.binary) result.binary = inputItem.binary;
return [result];
