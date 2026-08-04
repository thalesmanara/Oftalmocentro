/**
 * Full frontend API envelope audit.
 * Flags 2xx responses that would throw INVALID_RESPONSE in parseApiResponse.
 */
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';

function isEnvelope(value) {
  return Boolean(value && typeof value === 'object' && 'success' in value);
}

function classify(status, body, textLen) {
  if (status === 204) return { kind: 'OK_204' };
  let payload = null;
  try {
    payload = textLen ? JSON.parse(body) : null;
  } catch {
    return { kind: 'INVALID_RESPONSE', reason: 'non-json', preview: body.slice(0, 120) };
  }
  if (status >= 200 && status < 300) {
    if (payload == null) return { kind: 'INVALID_RESPONSE', reason: 'empty-body' };
    // nested wrapper used by some admin WFs
    if (!isEnvelope(payload) && payload.response && isEnvelope(payload.response)) {
      return {
        kind: 'INVALID_RESPONSE',
        reason: 'nested-response-envelope',
        topKeys: Object.keys(payload),
      };
    }
    if (!isEnvelope(payload)) {
      return {
        kind: 'INVALID_RESPONSE',
        reason: 'no-success-field',
        topKeys: Object.keys(payload),
        preview: body.slice(0, 160),
      };
    }
    if (payload.success === false) {
      return {
        kind: 'OK_ENVELOPE_FALSE',
        code: payload.error?.code,
        message: payload.error?.message,
      };
    }
    return { kind: 'OK', dataType: Array.isArray(payload.data) ? 'array' : typeof payload.data };
  }
  if (isEnvelope(payload)) {
    return {
      kind: status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
      code: payload.error?.code || payload.success,
      message: payload.error?.message,
    };
  }
  return {
    kind: 'HTTP_ERROR_RAW',
    status,
    preview: body.slice(0, 160),
  };
}

async function call(method, path, token, body) {
  const headers = {
    Accept: 'application/json',
    'X-Request-Id': crypto.randomUUID(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return {
      method,
      path,
      status: 0,
      ms: Date.now() - started,
      kind: 'NETWORK',
      reason: e.message,
    };
  }
  const text = await res.text();
  const c = classify(res.status, text, text.length);
  return {
    method,
    path,
    status: res.status,
    ms: Date.now() - started,
    len: text.length,
    ...c,
  };
}

// Login — prefer master if available, else lab
const candidates = [
  { email: 'master@oftalmocentro.com.br', password: 'master123' },
  { email: 'compras@oftalmocentrouberaba.com.br', password: '12345678' },
];

let token = null;
let loginEmail = null;
for (const c of candidates) {
  const r = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });
  const j = await r.json().catch(() => null);
  const t = j?.data?.accessToken || j?.data?.token;
  if (r.ok && t) {
    token = t;
    loginEmail = c.email;
    console.log('logged in as', c.email, 'keys', Object.keys(j.data || {}));
    break;
  }
  console.log('login fail', c.email, r.status, j?.error?.message || '');
}
if (!token) {
  console.error('no token');
  process.exit(1);
}

// Resolve sample IDs for detail endpoints
const docsRes = await call('GET', '/webhook/documents', token);
const docsPayload = docsRes.kind === 'OK' ? JSON.parse((await (await fetch(`${BASE}/webhook/documents`, { headers: { Authorization: `Bearer ${token}` } })).text())).data : [];
const docId = docsPayload?.[0]?.id;
const versionId = docsPayload?.[0]?.currentVersionId;

let auditId = null;
{
  const r = await fetch(`${BASE}/webhook/audit`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  try {
    const j = JSON.parse(t);
    auditId = j?.data?.items?.[0]?.id || j?.data?.[0]?.id || null;
  } catch {}
}

let runId = null;
{
  const r = await fetch(`${BASE}/webhook/system/ai-eval/runs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  try {
    const j = JSON.parse(t);
    runId = j?.data?.items?.[0]?.id || j?.data?.[0]?.id || null;
  } catch {}
}

let evidenceId = null;
let evidenceVersionId = null;
{
  const r = await fetch(`${BASE}/webhook/system/ai-evidence`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  try {
    const j = JSON.parse(t);
    const items = j?.data?.items || j?.data || [];
    evidenceId = items?.[0]?.id || null;
    evidenceVersionId = items?.[0]?.publishedVersion?.id || null;
  } catch {}
}

const GETs = [
  // core
  ['GET', '/webhook/settings'],
  ['GET', '/webhook/health'],
  ['GET', '/webhook/system/health'],
  ['GET', '/webhook/permissions'],
  ['GET', '/webhook/sectors'],
  ['GET', '/webhook/categories'],
  ['GET', '/webhook/subcategories'],
  ['GET', '/webhook/users'],
  ['GET', '/webhook/documents'],
  ['GET', '/webhook/audit'],
  ['GET', '/webhook/system/backups'],
  // documents detail-ish
  docId ? ['GET', `/webhook/documents/versions?documentId=${encodeURIComponent(docId)}`] : null,
  docId && versionId
    ? [
        'GET',
        `/webhook/documents/versions/detail?documentId=${encodeURIComponent(docId)}&versionId=${encodeURIComponent(versionId)}`,
      ]
    : null,
  docId && versionId
    ? [
        'GET',
        `/webhook/documents/tabular/preview?documentId=${encodeURIComponent(docId)}&versionId=${encodeURIComponent(versionId)}`,
      ]
    : null,
  auditId ? ['GET', `/webhook/audit/detail?id=${encodeURIComponent(auditId)}`] : null,
  // AI governance pages
  ['GET', '/webhook/system/ai-prompts'],
  ['GET', '/webhook/system/ai-prompts/compare'],
  ['GET', '/webhook/system/ai-retrieval'],
  ['GET', '/webhook/system/ai-context'],
  ['GET', '/webhook/system/ai-context/compare'],
  ['GET', '/webhook/system/ai-cache'],
  ['GET', '/webhook/system/ai-cache/compare'],
  ['GET', '/webhook/system/ai-cache/metrics'],
  ['GET', '/webhook/system/ai-cache/entries'],
  ['GET', '/webhook/system/ai-evidence'],
  ['GET', '/webhook/system/ai-evidence/compare'],
  evidenceId
    ? ['GET', `/webhook/system/ai-evidence/detail?id=${encodeURIComponent(evidenceId)}`]
    : ['GET', '/webhook/system/ai-evidence/detail'],
  ['GET', '/webhook/system/ai-eval/cases'],
  ['GET', '/webhook/system/ai-eval/runs'],
  runId ? ['GET', `/webhook/system/ai-eval/runs/detail?runId=${encodeURIComponent(runId)}`] : null,
  runId
    ? ['GET', `/webhook/system/ai-eval/export?runId=${encodeURIComponent(runId)}&format=json`]
    : null,
  // tags if exists
  ['GET', '/webhook/tags'],
].filter(Boolean);

console.log('\n=== probing', GETs.length, 'GET endpoints as', loginEmail, '===\n');
console.log('sample docId', docId, 'versionId', versionId, 'evidenceId', evidenceId);

const results = [];
for (const [method, path] of GETs) {
  const r = await call(method, path, token);
  results.push(r);
  const mark =
    r.kind === 'OK' || r.kind === 'OK_204'
      ? 'OK '
      : r.kind === 'INVALID_RESPONSE'
        ? '!! '
        : r.kind === 'FORBIDDEN'
          ? '403'
          : '.. ';
  console.log(
    mark,
    r.status,
    r.kind.padEnd(22),
    (r.reason || r.code || '').toString().slice(0, 28).padEnd(28),
    path,
  );
}

const invalid = results.filter((r) => r.kind === 'INVALID_RESPONSE');
const forbidden = results.filter((r) => r.kind === 'FORBIDDEN');
const other = results.filter(
  (r) => !['OK', 'OK_204', 'INVALID_RESPONSE', 'FORBIDDEN'].includes(r.kind),
);

console.log('\n=== SUMMARY ===');
console.log('OK', results.filter((r) => r.kind === 'OK' || r.kind === 'OK_204').length);
console.log('INVALID_RESPONSE', invalid.length);
for (const r of invalid) {
  console.log(' -', r.path, r.reason, r.preview || r.topKeys || '');
}
console.log('FORBIDDEN', forbidden.length);
for (const r of forbidden) console.log(' -', r.path, r.message);
console.log('OTHER', other.length);
for (const r of other) console.log(' -', r.path, r.kind, r.status, r.preview || r.message || '');
