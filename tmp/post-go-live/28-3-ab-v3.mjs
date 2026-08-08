/**
 * Quick A/B: hybrid-v1 vs hybrid-v2 vs hybrid-v3 on existing blind cases
 */
import { readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';

async function api(method, path, token, body, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 300) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

const cases = JSON.parse(readFileSync('tmp/post-go-live/28-3-blind-cases.json', 'utf8'));
const list = Array.isArray(cases) ? cases : cases.cases || [];
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const versions = (
  await c.query(
    `SELECT id, version_label, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-v2','hybrid-v3')`,
  )
).rows;
await c.end();

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
if (!token) throw new Error('login failed');

function questionOf(cas) {
  return cas.question || cas.questionB || cas.questionA || cas.termB || cas.termA || '';
}

function hit(cas, sources) {
  const id = cas.expectedDocumentId;
  const title = String(cas.expectedDocumentTitle || '').toLowerCase();
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const sid = s.documentId || s.id;
    const st = String(s.documentTitle || s.title || '').toLowerCase();
    if ((id && sid === id) || (title && st.includes(title.slice(0, 24)))) {
      return { hit: true, rank: i + 1 };
    }
  }
  return { hit: false, rank: null };
}

async function runLabel(label, versionId) {
  const rows = [];
  for (const cas of list) {
    const q = questionOf(cas);
    if (!q) continue;
    const t0 = Date.now();
    const r = await api('POST', '/webhook/consulta-ia', token, {
      question: q,
      retrievalConfigVersionId: versionId,
      modeOverrideAllowed: true,
    });
    const sources = r.json?.data?.sources || [];
    const h = hit(cas, sources);
    rows.push({
      id: cas.id || cas.name,
      category: cas.category || cas.group,
      status: r.status,
      latencyMs: Date.now() - t0,
      sourceCount: sources.length,
      ...h,
    });
    process.stdout.write('.');
  }
  const hits = rows.filter((x) => x.hit).length;
  const mrr =
    rows.reduce((a, x) => a + (x.rank ? 1 / x.rank : 0), 0) / Math.max(rows.length, 1);
  const byCat = {};
  for (const x of rows) {
    const k = x.category || 'other';
    byCat[k] = byCat[k] || { n: 0, hits: 0 };
    byCat[k].n++;
    if (x.hit) byCat[k].hits++;
  }
  return {
    label,
    versionId,
    n: rows.length,
    hitRate: hits / Math.max(rows.length, 1),
    mrr,
    avgLatency: rows.reduce((a, x) => a + x.latencyMs, 0) / Math.max(rows.length, 1),
    byCat,
    rows,
  };
}

const out = { at: new Date().toISOString(), versions, results: [] };
for (const v of ['hybrid-v1', 'hybrid-v2', 'hybrid-v3']) {
  const row = versions.find((x) => x.version_label === v);
  if (!row) continue;
  console.log('\nRUN', v);
  out.results.push(await runLabel(v, row.id));
}

const v1 = out.results.find((r) => r.label === 'hybrid-v1');
const v2 = out.results.find((r) => r.label === 'hybrid-v2');
const v3 = out.results.find((r) => r.label === 'hybrid-v3');

function score(r) {
  if (!r) return -1;
  return r.hitRate * 0.7 + r.mrr * 0.3;
}

const ranked = [v1, v2, v3].filter(Boolean).sort((a, b) => score(b) - score(a));
out.decision = {
  winner: ranked[0]?.label,
  scores: Object.fromEntries([v1, v2, v3].filter(Boolean).map((r) => [r.label, { hitRate: r.hitRate, mrr: r.mrr, score: score(r) }])),
  recommendPublish: ranked[0]?.label || 'hybrid-v1',
};

writeFileSync('tmp/post-go-live/28-3-v1-v2-v3-ab.json', JSON.stringify(out, null, 2));
console.log('\nDECISION', JSON.stringify(out.decision, null, 2));
