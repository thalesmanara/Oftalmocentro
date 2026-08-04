#!/usr/bin/env node
/**
 * Etapa 28 — fecha run órfã STARTED e dispara dataset completo (100 casos),
 * com timeout longo e poll até SUCCESS/PARTIAL/FAILED.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

// Close orphan STARTED with 0 results
const closed = await c.query(`
  UPDATE ai_test_runs
  SET status='FAILED', finished_at=NOW(), overall_score=0,
      metadata = COALESCE(metadata, '{}'::jsonb) || '{"e28":"closed orphan STARTED"}'::jsonb
  WHERE status='STARTED' AND COALESCE(total_cases,0)=0 AND finished_at IS NULL
    AND started_at < NOW() - INTERVAL '5 minutes'
  RETURNING id`);
console.log('closed orphans', closed.rows);

const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.cloud'.replace('.cloud','.com.br'),
      password: '12345678',
    }),
  })
).json();
const token = login?.data?.token || login?.data?.accessToken;
if (!token) {
  console.error('no token', login);
  process.exit(1);
}

async function req(path, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch {
      j = { raw: text.slice(0, 800) };
    }
    return { status: res.status, j, text: text.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

console.log('triggering full dataset...');
const t0 = Date.now();
let triggered;
try {
  // Sem groupName = todos os grupos; missing docs como SKIPPED
  triggered = await req(
    '/webhook/system/ai-eval/run-dataset',
    {
      triggerMode: 'go-live-final',
      includeMissingDocs: true,
    },
    45 * 60 * 1000,
  );
} catch (e) {
  triggered = { status: 0, j: { error: e.message } };
}
console.log('trigger done', Date.now() - t0, 'ms', triggered.status, JSON.stringify(triggered.j)?.slice(0, 400));

// Poll regardless (workflow may continue after client abort)
let latest = null;
for (let i = 0; i < 90; i++) {
  const { rows } = await c.query(`
    SELECT id, status, total_cases, passed_count, failed_count, error_count, overall_score,
           started_at, finished_at, trigger_mode, retrieval_mode, retrieval_config_version,
           prompt_version, model_name
    FROM ai_test_runs
    ORDER BY started_at DESC LIMIT 1`);
  latest = rows[0];
  console.log(
    'poll',
    i,
    latest?.status,
    'cases',
    latest?.total_cases,
    'pass',
    latest?.passed_count,
    'fail',
    latest?.failed_count,
    latest?.id,
  );
  const st = String(latest?.status || '').toUpperCase();
  if (['SUCCESS', 'PARTIAL', 'FAILED', 'COMPLETED', 'ERROR'].includes(st) && latest?.total_cases > 0) {
    break;
  }
  if (st === 'STARTED' && Number(latest?.total_cases) === 0 && i > 4) {
    // still empty after ~2.5min — wait more but log
  }
  await new Promise((r) => setTimeout(r, 30000));
}

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

const skipped = results.filter((r) =>
  ['SKIPPED', 'BLOCKED', 'SKIP'].includes(String(r.verdict || '').toUpperCase()),
).length;
const summary = {
  at: new Date().toISOString(),
  triggered,
  latestRun: latest,
  totals: latest
    ? {
        total: latest.total_cases,
        passed: latest.passed_count,
        failed: latest.failed_count,
        errors: latest.error_count,
        skipped,
        score: latest.overall_score,
        status: latest.status,
      }
    : null,
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
  metrics,
  criteria: {
    zeroStructuralError:
      results.filter((r) => r.is_internal_error || r.verdict === 'ERROR').length === 0,
    hasRun: !!latest,
    fullOrNearFull: Number(latest?.total_cases || 0) >= 80,
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

- id: \`${latest?.id || 'n/a'}\`
- status: **${latest?.status || 'n/a'}**
- trigger: ${latest?.trigger_mode || 'n/a'}
- total: ${latest?.total_cases ?? 'n/a'}
- PASS: ${latest?.passed_count ?? 'n/a'}
- FAIL: ${latest?.failed_count ?? 'n/a'}
- ERROR: ${latest?.error_count ?? 'n/a'}
- SKIPPED (amostra results): ${skipped}
- score: ${latest?.overall_score ?? 'n/a'}
- retrieval: ${latest?.retrieval_mode || ''} / ${latest?.retrieval_config_version || ''}
- prompt: ${latest?.prompt_version || ''}

## Policy

- ABSTAIN: ${summary.policy.abstain}
- DECLINE: ${summary.policy.decline}
- WARNING: ${summary.policy.warning}
- Hallucinations: ${summary.hallucinations}
- Technical errors: ${summary.technicalErrors}

## Critérios

- Zero erro estrutural: **${summary.criteria.zeroStructuralError}**
- Run ~completo (≥80): **${summary.criteria.fullOrNearFull}**
`,
);

console.log(JSON.stringify(summary.totals, null, 2));
await c.end();
