#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const out = JSON.parse(readFileSync(new URL('./_c211-admin-ab.json', import.meta.url), 'utf8'));
console.log('admin temp', out.admin);
console.log('smokeLegacy', out.ab?.smokeLegacy);
console.log('metricsSample', out.ab?.metricsSample);

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const groups = await client.query(
  `SELECT group_name, COUNT(*)::int AS n FROM ai_test_cases WHERE status='active' GROUP BY group_name ORDER BY n DESC`,
);
console.log('groups', groups.rows);

const runId = out.ab?.smokeLegacy?.runId;
if (runId) {
  const run = await client.query(`SELECT id, status, error_message, context_config_version_id, context_mode_override_used FROM ai_test_runs WHERE id=$1`, [runId]);
  console.log('run', run.rows[0]);
  const res = await client.query(`SELECT COUNT(*)::int AS n FROM ai_test_results WHERE run_id=$1`, [runId]);
  console.log('results count', res.rows[0]);
  const exec = await client.query(
    `SELECT id, status, "workflowId", "startedAt", "stoppedAt"
     FROM execution_entity WHERE "workflowId" IN ('KdpEmEGHNlPICOa4','12t0Ol6zWQJgAKPC','qVH5qtBf8IY32uiH')
     ORDER BY "startedAt" DESC LIMIT 8`,
  );
  console.log('recent execs', exec.rows);
}

// Probe create response shape
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
    versionLabel: `context-probe-${Date.now()}`,
    configuration: {
      mode: 'BUDGETED',
      modelName: 'gpt-4.1-mini',
      contextLimitTokens: 16000,
      reservedResponseTokens: 800,
      reservedSystemTokens: 1500,
      safetyMarginTokens: 400,
      maxChunks: 10,
      maxChunksPerDocument: 3,
      minChunkScore: 0.05,
      enableNeighbors: false,
      maxNeighborsPerChunk: 0,
      enableRedundancyRemoval: true,
      redundancyThreshold: 0.9,
      enableConflictPreservation: true,
    },
    notes: 'probe',
  }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));
console.log('create keys', Object.keys(created.j || {}), Object.keys(created.j?.data || {}));
console.log(JSON.stringify(created.j, null, 2).slice(0, 1500));

const vid = created.j?.data?.version?.id || created.j?.data?.id || created.j?.version?.id;
if (vid) {
  await client.query(`UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1`, [vid]);
  console.log('archived probe', vid);
}

// Check AB run results
for (const arm of ['A', 'B']) {
  for (const g of out.ab?.groupRuns?.[arm] || []) {
    const c = await client.query(
      `SELECT status, (SELECT COUNT(*) FROM ai_test_results r WHERE r.run_id=t.id) AS results
       FROM ai_test_runs t WHERE id=$1`,
      [g.runId],
    );
    console.log(arm, g.group, g.runId, c.rows[0]);
  }
}

await client.end();
