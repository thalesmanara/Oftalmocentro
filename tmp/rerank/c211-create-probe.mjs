#!/usr/bin/env node
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

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

const r = await fetch(`${BASE}/webhook/system/ai-context/create`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'BUDGETED',
    versionLabel: `probe2-${Date.now()}`,
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
});
const text = await r.text();
console.log('status', r.status, 'len', text.length);
console.log(text.slice(0, 1500));

// Why runs FAILED
const run = await client.query(
  `SELECT status, total_cases, passed_count, failed_count, error_count, report
   FROM ai_test_runs WHERE id='884ae130-d060-4100-a52e-64cf9710a0b8'`,
);
console.log('run', run.rows[0]?.status, {
  total: run.rows[0]?.total_cases,
  passed: run.rows[0]?.passed_count,
  failed: run.rows[0]?.failed_count,
  error: run.rows[0]?.error_count,
});
console.log('report keys', Object.keys(run.rows[0]?.report || {}));
console.log(JSON.stringify(run.rows[0]?.report).slice(0, 800));

// Archive orphan probes
await client.query(
  `UPDATE ai_context_config_versions SET status='ARCHIVED'
   WHERE status='DRAFT' AND (version_label LIKE 'probe%' OR version_label LIKE 'context-tmp%' OR version_label LIKE 'context-pubtest%')`,
);

const prod = await client.query(
  `SELECT version_label, status, mode FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
console.log('published', prod.rows);

await client.end();
