/**
 * Simulate front parseApiResponse after normalize + verify POSTs used by Evidence/Cache pages.
 */
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';

function isEnvelope(v) {
  return Boolean(v && typeof v === 'object' && 'success' in v);
}
function normalize(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (isEnvelope(payload)) return payload;
  if (isEnvelope(payload.response)) return payload.response;
  return payload;
}

const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token = login.data.token;
const auth = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function check(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: auth,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let raw = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    return { method, path, status: r.status, kind: 'INVALID', reason: 'non-json' };
  }
  const payload = normalize(raw);
  if (r.status >= 200 && r.status < 300) {
    if (!isEnvelope(payload)) {
      return {
        method,
        path,
        status: r.status,
        kind: 'INVALID',
        reason: text.length ? 'no-success' : 'empty',
        keys: raw && Object.keys(raw),
      };
    }
    if (payload.success === false) {
      return { method, path, status: r.status, kind: 'ENVELOPE_FALSE', code: payload.error?.code };
    }
    return { method, path, status: r.status, kind: 'OK' };
  }
  return {
    method,
    path,
    status: r.status,
    kind: isEnvelope(payload) ? 'HTTP_ENVELOPE' : 'HTTP_RAW',
    code: payload?.error?.code || payload?.code,
    message: payload?.error?.message,
  };
}

const cfg = {
  mode: 'STRUCTURED_STRICT',
  enableEvidenceScore: true,
  enableClassification: true,
  enableConflictConsolidation: true,
  enableRedundancyDetection: true,
  enableRichSources: true,
  passthroughToCwm: true,
  minEvidenceScore: 40,
  redundancyThreshold: 0.9,
  dropBelowMinScore: true,
};

const checks = [
  await check('GET', '/webhook/system/ai-evidence'),
  await check('GET', '/webhook/system/ai-evidence/detail'),
  await check('GET', '/webhook/system/ai-evidence/compare'),
  await check('POST', '/webhook/system/ai-evidence/validate', {
    mode: 'STRUCTURED_STRICT',
    configuration: cfg,
  }),
  await check('GET', '/webhook/system/ai-cache'),
  await check('GET', '/webhook/system/ai-cache/detail'),
  await check('GET', '/webhook/system/ai-cache/compare'),
  await check('GET', '/webhook/system/ai-cache/metrics'),
  await check('GET', '/webhook/system/ai-cache/entries'),
  await check('POST', '/webhook/system/ai-cache/validate', {
    mode: 'SHADOW',
    configuration: { mode: 'SHADOW', ttlSeconds: 3600 },
  }),
  await check('GET', '/webhook/documents'),
  await check('GET', '/webhook/system/health'),
  await check('GET', '/webhook/sectors'),
  await check('GET', '/webhook/categories'),
];

let bad = 0;
for (const c of checks) {
  const mark = c.kind === 'OK' || c.kind === 'HTTP_ENVELOPE' ? 'OK' : '!!';
  if (c.kind === 'INVALID') bad++;
  console.log(mark, c.status, c.kind, c.reason || c.code || '', c.method, c.path);
}
console.log('\nINVALID_RESPONSE-like:', bad);
