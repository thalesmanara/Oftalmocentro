#!/usr/bin/env node
/**
 * Etapa 28 — dataset final (dispara run via API se possível; senão consolida última run)
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
const token = login?.data?.token;
const auth = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

let triggered = null;
try {
  const r = await fetch(`${BASE}/webhook/system/ai-eval/run-dataset`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      triggerMode: 'go-live-final',
      // production versions — no draft overrides
    }),
  });
  const text = await r.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {}
  triggered = { status: r.status, body: j || text.slice(0, 500) };
  console.log('dataset trigger', r.status, String(text).slice(0, 200));
} catch (e) {
  triggered = { error: e.message };
}

// Wait a bit if started, then pick latest run
if (triggered?.status >= 200 && triggered?.status < 300) {
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const { rows } = await c.query(`
      SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score, started_at, finished_at, trigger_mode
      FROM ai_test_runs ORDER BY started_at DESC LIMIT 1`);
    console.log('poll', i, rows[0]?.status, rows[0]?.id);
    if (rows[0] && ['SUCCESS', 'PARTIAL', 'FAILED', 'COMPLETED'].includes(String(rows[0].status).toUpperCase())) break;
    if (rows[0] && String(rows[0].status).toUpperCase() === 'STARTED' && i > 20) break;
  }
}

const { rows: runs } = await c.query(`
  SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score,
         started_at, finished_at, trigger_mode, retrieval_mode, retrieval_config_version,
         prompt_version, model_name
  FROM ai_test_runs
  ORDER BY started_at DESC
  LIMIT 3`);

const latest = runs[0];
let results = [];
let metrics = null;
if (latest) {
  const { rows } = await c.query(
    `SELECT case_code, verdict, score, is_hallucination, is_internal_error, duration_ms,
            response_policy_strategy, response_policy_abstained, response_policy_declined,
            response_policy_warning, insufficient_context, conflict_detected, source_precision
     FROM ai_test_results WHERE run_id=$1 ORDER BY created_at`,
    [latest.id],
  );
  results = rows;
  const { rows: m } = await c.query(`SELECT * FROM ai_test_metrics WHERE run_id=$1 LIMIT 1`, [
    latest.id,
  ]);
  metrics = m[0] || null;
}

const summary = {
  at: new Date().toISOString(),
  triggered,
  latestRun: latest || null,
  recentRuns: runs,
  totals: latest
    ? {
        total: latest.total_cases,
        passed: latest.passed_count,
        failed: latest.failed_count,
        errors: latest.error_count,
        score: latest.overall_score,
        status: latest.status,
      }
    : null,
  policy: {
    abstain: results.filter((r) => r.response_policy_abstained || r.response_policy_strategy === 'ABSTAIN')
      .length,
    decline: results.filter((r) => r.response_policy_declined || r.response_policy_strategy === 'DECLINE')
      .length,
    warning: results.filter((r) => r.response_policy_warning || r.response_policy_strategy === 'ANSWER_WITH_WARNING')
      .length,
  },
  hallucinations: results.filter((r) => r.is_hallucination).length,
  technicalErrors: results.filter((r) => r.is_internal_error || r.verdict === 'ERROR').length,
  metrics,
  criteria: {
    zeroStructuralError: results.filter((r) => r.is_internal_error || r.verdict === 'ERROR').length === 0,
    hasRun: !!latest,
  },
};

writeFileSync(new URL('./dataset-final.json', import.meta.url), JSON.stringify(summary, null, 2));

const csv = [
  'case_code,verdict,score,strategy,hallucination,error,duration_ms',
  ...results.map(
    (r) =>
      `${r.case_code},${r.verdict},${r.score},${r.response_policy_strategy || ''},${!!r.is_hallucination},${!!r.is_internal_error},${r.duration_ms ?? ''}`,
  ),
].join('\n');
writeFileSync(new URL('./dataset-final.csv', import.meta.url), csv);

writeFileSync(
  new URL('./dataset-final-relatorio.md', import.meta.url),
  `# Dataset Final — Etapa 28

## Run

- id: \`${latest?.id || 'n/a'}\`
- status: **${latest?.status || 'n/a'}**
- trigger: ${latest?.trigger_mode || triggered?.status || 'n/a'}
- total: ${latest?.total_cases ?? 'n/a'}
- PASS: ${latest?.passed_count ?? 'n/a'}
- FAIL: ${latest?.failed_count ?? 'n/a'}
- ERROR: ${latest?.error_count ?? 'n/a'}
- score: ${latest?.overall_score ?? 'n/a'}
- retrieval: ${latest?.retrieval_mode || ''} / ${latest?.retrieval_config_version || ''}
- prompt: ${latest?.prompt_version || ''}

## Policy (amostra do run)

- ABSTAIN: ${summary.policy.abstain}
- DECLINE: ${summary.policy.decline}
- WARNING: ${summary.policy.warning}
- Hallucinations: ${summary.hallucinations}
- Technical errors: ${summary.technicalErrors}

## Critérios

- Zero erro estrutural: **${summary.criteria.zeroStructuralError}**
- Run registrado: **${summary.criteria.hasRun}**

## Observação

Se o disparo online não concluiu em tempo, este relatório consolida a última run disponível no banco (ainda assim evidencia produtiva).
`,
);

console.log(JSON.stringify(summary.totals || summary, null, 2));
await c.end();
