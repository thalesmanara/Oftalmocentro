#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const out = JSON.parse(readFileSync(new URL('./_c211-retest.json', import.meta.url), 'utf8'));
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Verify A/B arms actually used different context modes
for (const arm of ['A', 'B']) {
  for (const g of out.ab[arm] || []) {
    const r = await client.query(
      `SELECT context_mode, COUNT(*)::int n, AVG(estimated_context_tokens)::float tokens,
              SUM(CASE WHEN conflict_detected THEN 1 ELSE 0 END)::int conflicts
       FROM ai_test_results WHERE run_id=$1 GROUP BY context_mode`,
      [g.runId],
    );
    const run = await client.query(
      `SELECT context_config_version_id, context_mode_override_used, status, total_cases FROM ai_test_runs WHERE id=$1`,
      [g.runId],
    );
    console.log(arm, g.group, run.rows[0], r.rows);
  }
}

// Conflict reasons remaining
const conflictSample = await client.query(
  `SELECT case_code, conflict_type, context_mode, left(question,80) q
   FROM ai_test_results
   WHERE run_id = ANY($1::uuid[]) AND conflict_detected
   ORDER BY case_code LIMIT 20`,
  [(out.ab.A || []).map((x) => x.runId).filter(Boolean)],
);
console.log('conflicts A', conflictSample.rows);

// Create envelope probe
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
const created = await fetch(`${BASE}/webhook/system/ai-context/create`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'BUDGETED',
    versionLabel: `probe-${Date.now()}`,
    configuration: {
      mode: 'BUDGETED',
      modelName: 'gpt-4.1-mini',
      contextLimitTokens: 16000,
      reservedResponseTokens: 800,
      reservedSystemTokens: 1500,
      safetyMarginTokens: 400,
      maxChunks: 8,
      maxChunksPerDocument: 2,
      minChunkScore: 0.05,
      enableNeighbors: false,
      maxNeighborsPerChunk: 0,
      enableRedundancyRemoval: true,
      redundancyThreshold: 0.9,
      enableConflictPreservation: true,
    },
  }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));
console.log('create envelope', JSON.stringify(created.j).slice(0, 1200));
const vid =
  created.j?.data?.version?.id ||
  created.j?.data?.id ||
  created.j?.version?.id ||
  created.j?.id;
if (vid) {
  await client.query(`UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1`, [vid]);
  console.log('archived', vid);
} else {
  // find latest draft
  const d = await client.query(
    `SELECT id, version_label, status FROM ai_context_config_versions WHERE version_label LIKE 'probe-%' OR version_label LIKE 'context-tmp%' ORDER BY created_at DESC LIMIT 5`,
  );
  console.log('recent drafts', d.rows);
  for (const row of d.rows) {
    if (row.status === 'DRAFT') {
      await client.query(`UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1`, [row.id]);
    }
  }
}

// Controlled publish+rollback with temp: attach validation run of budget override then try publish
// Skip actually publishing budget - create tiny temp config, publish with override+reason using smoke run if allowed, then rollback
const goodCfg = {
  mode: 'LEGACY',
  modelName: 'gpt-4.1-mini',
  contextLimitTokens: 32000,
  reservedResponseTokens: 1200,
  reservedSystemTokens: 2000,
  safetyMarginTokens: 800,
  maxChunks: 12,
  maxChunksPerDocument: 4,
  minChunkScore: 0.01,
  enableNeighbors: false,
  maxNeighborsPerChunk: 0,
  enableRedundancyRemoval: false,
  redundancyThreshold: 0.95,
  enableConflictPreservation: true,
};
const temp = await fetch(`${BASE}/webhook/system/ai-context/create`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'LEGACY',
    versionLabel: `context-pubtest-${Date.now()}`,
    configuration: goodCfg,
    notes: 'publish/rollback controlado etapa 21.1',
  }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));
console.log('temp create', temp.status, JSON.stringify(temp.j).slice(0, 800));

await client.end();
writeFileSync(new URL('./_c211-ab-verify.json', import.meta.url), JSON.stringify({ conflicts: conflictSample.rows, create: created.j }, null, 2));
