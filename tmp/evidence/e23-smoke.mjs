#!/usr/bin/env node
/**
 * Etapa 23 unit + smoke (evidence layer).
 */
import { writeFileSync } from 'fs';
import {
  buildEvidenceFromChunk,
  computeEvidenceScore,
  detectRedundancy,
  consolidateConflicts,
  validateEvidenceConfiguration,
  defaultEvidenceConfig,
  evidencesToSelectedChunks,
} from './evidence-helpers.mjs';

const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 200) : '');
}

const chunk = {
  chunkId: 'c1',
  documentId: 'd1',
  documentVersionId: 'v1',
  documentTitle: 'Protocolo POP',
  sectorName: 'Qualidade',
  categoryName: 'Normas',
  subcategoryName: 'POP',
  text: 'Procedimento operacional padrão de esterilização. Vigência 2026.',
  hybridScore: 0.82,
  rerankScore: 0.9,
  isCurrent: true,
  ocrQualityGrade: 'A',
  chunkKind: 'text',
};
const e = buildEvidenceFromChunk(chunk, 0);
ok('evidence id', !!e.evidenceId);
ok('score 0-100', e.evidenceScore >= 0 && e.evidenceScore <= 100, e.evidenceScore);
ok('grade', ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'LOW', 'POOR'].includes(e.evidenceGrade));
ok('labels', e.labels.includes('Evidência normativa') || e.labels.includes('Evidência positiva'), e.labels);

const dup = detectRedundancy(
  [
    buildEvidenceFromChunk(chunk, 0),
    buildEvidenceFromChunk({ ...chunk, chunkId: 'c2', text: chunk.text }, 1),
  ],
  0.9,
);
ok('redundancy detected', dup.redundancyCount >= 1, dup);

const conflict = consolidateConflicts([
  buildEvidenceFromChunk(
    {
      ...chunk,
      documentId: 'dA',
      text: 'CRM 12345 recebe R$ 1.000,00',
    },
    0,
  ),
  buildEvidenceFromChunk(
    {
      ...chunk,
      documentId: 'dB',
      documentTitle: 'Folha',
      text: 'CRM 12345 recebe R$ 2.500,00',
    },
    1,
  ),
]);
ok('conflict monetary', conflict.conflictDetected === true, conflict);

ok('validate default', validateEvidenceConfiguration(defaultEvidenceConfig()).ok === true);
ok('validate bad mode', validateEvidenceConfiguration({ mode: 'FOO' }).ok === false);
ok(
  'chunks mapping preserves doc',
  evidencesToSelectedChunks([e])[0].documentId === 'd1',
);

const poor = computeEvidenceScore({
  text: 'x',
  hybridScore: 0.1,
  isCurrent: false,
  expirationDate: '2000-01-01',
  ocrQualityGrade: 'POOR',
  chunkKind: 'ocr',
});
ok('expired/poor lower score', poor.evidenceScore < 50, poor);

// Live smoke
const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
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
const token = login?.data?.accessToken || login?.data?.token;
ok('login', !!token);

function unwrap(j) {
  return j?.response?.data ?? j?.data ?? j;
}

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text.slice(0, 200) };
  }
  return { status: r.status, j, data: unwrap(j), statusCode: j?.statusCode };
}

const noAuth = await fetch(`${BASE}/webhook/system/ai-evidence`);
const noAuthJ = await noAuth.json().catch(() => ({}));
ok(
  '401 evidence list',
  noAuth.status === 401 || noAuthJ?.statusCode === 401 || noAuthJ?.response?.success === false,
  { status: noAuth.status, code: noAuthJ?.statusCode },
);

const list = await api('GET', '/webhook/system/ai-evidence');
ok('list 200', list.status === 200, { status: list.status });
const item = list.data?.items?.[0];
ok(
  'list evidence-v1',
  item?.activeVersionLabel === 'evidence-v1' ||
    item?.publishedVersion?.versionLabel === 'evidence-v1' ||
    item?.activeMode === 'STRUCTURED',
  item,
);

const detail = await api('GET', '/webhook/system/ai-evidence/detail');
ok('detail 200', detail.status === 200);
const versions = detail.data?.versions || [];
ok(
  'has draft v2',
  versions.some((v) => v.versionLabel === 'evidence-v2' && v.status === 'DRAFT'),
  versions.map((v) => `${v.versionLabel}:${v.status}`),
);
ok(
  'single published v1',
  versions.filter((v) => v.status === 'PUBLISHED').length === 1 &&
    versions.find((v) => v.status === 'PUBLISHED')?.versionLabel === 'evidence-v1',
);

const bad = await api('POST', '/webhook/system/ai-evidence/validate', {
  mode: 'STRUCTURED',
  configuration: { ...defaultEvidenceConfig(), minEvidenceScore: 'x' },
});
ok(
  'validate rejects string min',
  bad.status === 400 ||
    bad.statusCode === 400 ||
    bad.data?.ok === false ||
    bad.j?.response?.data?.ok === false ||
    (Array.isArray(bad.data?.errors) && bad.data.errors.length > 0),
  { status: bad.status, data: bad.data },
);

const good = await api('POST', '/webhook/system/ai-evidence/validate', {
  mode: 'STRUCTURED',
  configuration: defaultEvidenceConfig(),
});
ok(
  'validate ok',
  (good.status === 200 || good.statusCode === 200) &&
    (good.data?.ok === true || good.j?.response?.data?.ok === true),
  { status: good.status, data: good.data },
);

const q = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
});
ok('consulta 200', q.status === 200, { status: q.status });
const em = q.data?.evidenceMeta;
ok(
  'evidenceMeta present or passthrough',
  em == null || (typeof em.evidenceCount === 'number' && em.configVersion === 'evidence-v1'),
  em,
);
ok('answerFromCache still false/absent', q.data?.cacheMeta?.answerFromCache !== true, q.data?.cacheMeta);

const health = await api('GET', '/webhook/system/health');
const el = health.data?.components?.evidenceLayer;
ok('health evidenceLayer', el?.activeVersion === 'evidence-v1' || el?.activeMode === 'STRUCTURED', el);

import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const secrets = await client.query(
  `SELECT key,value FROM app_secrets WHERE key IN (
    'evidence_active_mode','evidence_active_version','cache_active_mode','cache_active_version',
    'context_active_mode','context_active_version','retrieval_active_mode','retrieval_active_version'
  ) ORDER BY 1`,
);
ok(
  'prod secrets intact + evidence',
  JSON.stringify(Object.fromEntries(secrets.rows.map((r) => [r.key, r.value]))) ===
    JSON.stringify({
      cache_active_mode: 'SHADOW',
      cache_active_version: 'cache-shadow-v1',
      context_active_mode: 'LEGACY',
      context_active_version: 'context-v1',
      evidence_active_mode: 'STRUCTURED',
      evidence_active_version: 'evidence-v1',
      retrieval_active_mode: 'HYBRID',
      retrieval_active_version: 'hybrid-v1',
    }),
  secrets.rows,
);
await client.end();

out.summary = {
  pass: out.tests.filter((t) => t.pass).length,
  fail: out.tests.filter((t) => !t.pass).length,
  total: out.tests.length,
};
writeFileSync(new URL('./_e23-smoke.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('SUMMARY', out.summary);
process.exit(out.summary.fail > 0 ? 1 : 0);
