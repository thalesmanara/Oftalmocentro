#!/usr/bin/env node
/**
 * Etapa 28 — dataset limpo pós-fix (100 casos), poll longo.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

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
const token = login?.data?.token || login?.data?.accessToken;
if (!token) throw new Error('no token');

const before = await c.query(`SELECT id FROM ai_test_runs ORDER BY started_at DESC LIMIT 1`);
const beforeId = before.rows[0]?.id;

console.log('trigger clean full dataset...');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 50 * 60 * 1000);
let triggered;
try {
  const res = await fetch(`${BASE}/webhook/system/ai-eval/run-dataset`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ triggerMode: 'go-live-final', includeMissingDocs: true }),
    signal: controller.signal,
  });
  const text = await res.text();
  triggered = { status: res.status, body: text.slice(0, 400) };
} catch (e) {
  triggered = { status: 0, error: e.message };
} finally {
  clearTimeout(timer);
}
console.log('trigger', triggered);

let latest = null;
for (let i = 0; i < 100; i++) {
  const { rows } = await c.query(`
    SELECT id, status, total_cases, passed_count, failed_count, error_count, skipped_count,
           overall_score, started_at, finished_at, trigger_mode, retrieval_mode,
           retrieval_config_version, prompt_version, model_name
    FROM ai_test_runs ORDER BY started_at DESC LIMIT 1`);
  latest = rows[0];
  const { rows: rc } = await c.query(
    `SELECT COUNT(*)::int n FROM ai_test_results WHERE run_id=$1`,
    [latest.id],
  );
  console.log(
    'poll',
    i,
    latest.status,
    'cases',
    latest.total_cases,
    'results',
    rc[0].n,
    'pass',
    latest.passed_count,
    'fail',
    latest.failed_count,
    'err',
    latest.error_count,
  );
  const st = String(latest.status || '').toUpperCase();
  if (
    latest.id !== beforeId &&
    ['SUCCESS', 'PARTIAL', 'FAILED', 'COMPLETED'].includes(st) &&
    Number(latest.total_cases) > 0
  ) {
    break;
  }
  await new Promise((r) => setTimeout(r, 20000));
}

const { rows: results } = await c.query(
  `SELECT case_code, verdict, score, is_hallucination, is_internal_error, duration_ms,
          response_policy_strategy, response_policy_abstained, response_policy_declined,
          response_policy_warning, insufficient_context, conflict_detected, source_precision
   FROM ai_test_results WHERE run_id=$1 ORDER BY created_at`,
  [latest.id],
);
const { rows: m } = await c.query(`SELECT * FROM ai_test_metrics WHERE run_id=$1 LIMIT 1`, [
  latest.id,
]);
const skipped = results.filter((r) =>
  ['SKIPPED', 'BLOCKED', 'SKIP'].includes(String(r.verdict || '').toUpperCase()),
).length;

const summary = {
  at: new Date().toISOString(),
  note: 'Run limpo após correção SyntaxError em IA - EXECUTAR TESTE (Avaliar e montar insert).',
  fixVersionId: '16b5ffbc-7d2e-42de-b1e2-a005915f5681',
  triggered,
  latestRun: latest,
  totals: {
    total: latest.total_cases,
    passed: latest.passed_count,
    failed: latest.failed_count,
    errors: latest.error_count,
    skipped: latest.skipped_count ?? skipped,
    score: latest.overall_score,
    status: latest.status,
  },
  policy: {
    abstain: results.filter(
      (r) => r.response_policy_abstained || r.response_policy_strategy === 'ABSTAIN',
    ).length,
    decline: results.filter(
      (r) => r.response_policy_declined || r.response_policy_strategy === 'DECLINE',
    ).length,
    warning: results.filter(
      (r) => r.response_policy_warning || r.response_policy_strategy === 'ANSWER_WITH_WARNING',
    ).length,
  },
  hallucinations: results.filter((r) => r.is_hallucination).length,
  technicalErrors: results.filter((r) => r.is_internal_error || r.verdict === 'ERROR').length,
  failedCases: results.filter((r) => r.verdict === 'FAIL').map((r) => ({
    code: r.case_code,
    score: r.score,
    strategy: r.response_policy_strategy,
  })),
  metrics: m[0] || null,
  criteria: {
    zeroStructuralError:
      results.filter((r) => r.is_internal_error || r.verdict === 'ERROR').length === 0,
    hasRun: !!latest,
    fullOrNearFull: Number(latest?.total_cases || 0) >= 80,
    zeroHallucination: results.filter((r) => r.is_hallucination).length === 0,
  },
};

writeFileSync(new URL('./dataset-final.json', import.meta.url), JSON.stringify(summary, null, 2));
writeFileSync(
  new URL('./dataset-final.csv', import.meta.url),
  [
    'case_code,verdict,score,strategy,hallucination,error,duration_ms',
    ...results.map(
      (r) =>
        `${r.case_code},${r.verdict},${r.score},${r.response_policy_strategy || ''},${!!r.is_hallucination},${!!r.is_internal_error},${r.duration_ms ?? ''}`,
    ),
  ].join('\n'),
);
writeFileSync(
  new URL('./dataset-final-relatorio.md', import.meta.url),
  `# Dataset Final — Etapa 28

## Run

- id: \`${latest.id}\`
- status: **${latest.status}**
- total: ${latest.total_cases}
- PASS: ${latest.passed_count}
- FAIL: ${latest.failed_count}
- ERROR: ${latest.error_count}
- SKIPPED: ${latest.skipped_count ?? skipped}
- score: ${latest.overall_score}
- retrieval: ${latest.retrieval_mode} / ${latest.retrieval_config_version}
- prompt: ${latest.prompt_version}
- correção prévia: SyntaxError no nó Avaliar (versionId \`16b5ffbc-7d2e-42de-b1e2-a005915f5681\`)

## Policy

- ABSTAIN: ${summary.policy.abstain}
- DECLINE: ${summary.policy.decline}
- WARNING: ${summary.policy.warning}
- Hallucinations: ${summary.hallucinations}
- Technical errors: ${summary.technicalErrors}

## Critérios

- Zero erro estrutural: **${summary.criteria.zeroStructuralError}**
- Run ≥80 casos: **${summary.criteria.fullOrNearFull}**
- Zero alucinação: **${summary.criteria.zeroHallucination}**

## Fails funcionais

${summary.failedCases.map((f) => `- ${f.code} score=${f.score} strategy=${f.strategy || '-'}`).join('\n') || '_nenhum_'}
`,
);

console.log(JSON.stringify(summary.totals, null, 2));
await c.end();
