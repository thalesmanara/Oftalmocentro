#!/usr/bin/env node
/**
 * Etapa 24 smoke — helpers + admin + live consulta responseMeta
 */
import { writeFileSync } from 'fs';
import {
  evaluateResponseQuality,
  validateResponseQualityConfiguration,
  defaultResponseQualityConfig,
  gradeFromScore,
} from './quality-helpers.mjs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(pass ? 'OK' : 'FAIL', name, detail || '');
}

// --- Unit helpers ---
{
  const empty = evaluateResponseQuality(
    { answer: '', sources: [], question: 'x' },
    defaultResponseQualityConfig(),
  );
  ok('empty answer low/poor', empty.qualityScore < 40 && empty.responseMeta.flags.emptyAnswer);

  const short = evaluateResponseQuality(
    { answer: 'ok', sources: [{ documentId: 'a', documentTitle: 'Doc A' }], question: 'x' },
    defaultResponseQualityConfig(),
  );
  ok('short answer flagged', short.responseMeta.flags.tooShort);

  const noSrc = evaluateResponseQuality(
    {
      answer: 'O valor do contrato é R$ 10.000 conforme documentação institucional detalhada.',
      sources: [],
      question: 'qual valor',
    },
    defaultResponseQualityConfig(),
  );
  ok('missing sources', noSrc.responseMeta.missingSources === true, `halluc=${noSrc.responseMeta.hallucinationSuspected}`);

  const good = evaluateResponseQuality(
    {
      answer:
        'Conforme o Contrato de Locação Estacionamento, o valor mensal está definido no documento e permanece vigente para o período atual da clínica.',
      sources: [
        {
          documentId: 'd1',
          documentTitle: 'Contrato de Locação Estacionamento',
          evidenceScore: 82,
          ocrGrade: 'A',
        },
      ],
      question: 'valor locação estacionamento',
      evidenceMeta: {
        evidenceCount: 3,
        averageEvidenceScore: 78,
        conflictDetected: false,
        confidenceDistribution: { HIGH: 2, MEDIUM: 1, LOW: 0 },
      },
      contextMeta: { insufficientContext: false },
    },
    defaultResponseQualityConfig(),
  );
  ok(
    'complete answer score>=55',
    good.qualityScore >= 55 && ['EXCELLENT', 'GOOD', 'ACCEPTABLE'].includes(good.qualityGrade),
    `score=${good.qualityScore} grade=${good.qualityGrade}`,
  );

  const conflict = evaluateResponseQuality(
    {
      answer: 'Certamente o valor é único e definitivo sem qualquer divergência.',
      sources: [{ documentId: 'd1', documentTitle: 'Doc' }],
      evidenceMeta: { conflictDetected: true, evidenceCount: 2, averageEvidenceScore: 60 },
      question: 'valor',
    },
    defaultResponseQualityConfig(),
  );
  ok(
    'conflict consistency',
    conflict.responseMeta.conflictDetected &&
      (conflict.consistencyStatus === 'ERROR' || conflict.consistencyStatus === 'WARNING'),
  );

  const expired = evaluateResponseQuality(
    {
      answer: 'Documento antigo menciona procedimento operacional padrão da clínica oftalmológica.',
      sources: [
        {
          documentId: 'd1',
          documentTitle: 'POP antigo',
          expirationDate: '2020-01-01',
          evidenceScore: 50,
        },
      ],
      question: 'procedimento',
      evidenceMeta: { evidenceCount: 1, averageEvidenceScore: 50 },
    },
    defaultResponseQualityConfig(),
  );
  ok('expired source flagged', expired.responseMeta.flags.expiredSource);

  const cfg = validateResponseQualityConfiguration({
    mode: 'VALIDATE',
    minAnswerLength: 40,
    maxAnswerLength: 100,
  });
  ok('config validate ok', cfg.ok);

  const badCfg = validateResponseQualityConfiguration({
    mode: 'NOPE',
    minAnswerLength: 100,
    maxAnswerLength: 10,
  });
  ok('config validate rejects', !badCfg.ok && badCfg.errors.length >= 1);

  ok('grades', gradeFromScore(90) === 'EXCELLENT' && gradeFromScore(30) === 'POOR');
}

// --- API ---
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
const token = login?.data?.token;
ok('login', !!token);
const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: auth });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  const envelope = j?.success != null ? j : j?.response;
  return { status: r.status, j, envelope, len: t.length };
}

{
  const list = await get('/webhook/system/ai-response-quality');
  ok('admin list', list.status === 200 && list.envelope?.success === true, `status=${list.status}`);
  const detail = await get('/webhook/system/ai-response-quality/detail');
  ok(
    'admin detail',
    detail.status === 200 && Array.isArray(detail.envelope?.data?.versions),
    `versions=${detail.envelope?.data?.versions?.length}`,
  );
  const pub = detail.envelope?.data?.activeVersion;
  ok(
    'published v1',
    pub?.versionLabel === 'response-quality-v1' && pub?.status === 'PUBLISHED',
    pub?.versionLabel,
  );
  const drafts = (detail.envelope?.data?.versions || []).filter((v) => v.status === 'DRAFT');
  ok(
    'draft v2 present',
    drafts.some((v) => v.versionLabel === 'response-quality-v2'),
  );
  const compare = await get('/webhook/system/ai-response-quality/compare');
  ok('admin compare', compare.status === 200 && compare.envelope?.success === true);
  const val = await fetch(`${BASE}/webhook/system/ai-response-quality/validate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      mode: 'VALIDATE',
      configuration: defaultResponseQualityConfig(),
    }),
  });
  const valJ = await val.json();
  const valEnv = valJ.success != null ? valJ : valJ.response;
  ok('admin validate', val.status === 200 && valEnv?.data?.ok === true);

  const health = await get('/webhook/system/health');
  ok(
    'health responseQuality',
    !!health.envelope?.data?.components?.responseQuality,
    JSON.stringify(health.envelope?.data?.components?.responseQuality || {}).slice(0, 120),
  );
}

// Live consulta
{
  const r = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      question: 'Qual o valor do contrato de locação do estacionamento?',
    }),
  });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  const data = j?.data || j?.response?.data;
  ok('consulta 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  ok('consulta has answer', !!data?.answer, String(data?.answer || '').slice(0, 80));
  ok(
    'consulta responseMeta',
    !!data?.responseMeta && data.responseMeta.schemaVersion === 'response-quality-schema-v1',
    JSON.stringify(data?.responseMeta || {}).slice(0, 180),
  );
  ok(
    'consulta qualityScore number',
    typeof data?.responseMeta?.qualityScore === 'number',
    `score=${data?.responseMeta?.qualityScore}`,
  );
  ok('evidenceMeta intact', !!data?.evidenceMeta);
  ok('cacheMeta intact', !!data?.cacheMeta);
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
writeFileSync(
  new URL('./_e24-smoke.json', import.meta.url),
  JSON.stringify({ passed, failed: failed.length, results }, null, 2),
);
console.log('\nSUMMARY', passed, '/', results.length, 'failed', failed.length);
if (failed.length) process.exitCode = 1;
