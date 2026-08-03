/**
 * Triggers Schedule - Embeddings Fila repeatedly until CURRENT pending/failed due is 0
 * or maxRounds reached. Uses n8n public API if N8N_API_KEY is set; else prints SQL status.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const PGURL =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const SCHEDULE_ID = 'HympisbYzMo0mQYP';
const N8N_BASE = (process.env.N8N_BASE_URL || 'https://n8n.revita.tec.br').replace(/\/$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const maxRounds = Number(process.env.BACKFILL_ROUNDS || 80);
const outFile = path.join('tmp', 'embeddings', 'backfill-status.json');

const client = new pg.Client({ connectionString: PGURL });
await client.connect();

async function status() {
  const { rows } = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE dc.embedding_status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE dc.embedding_status = 'FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE dc.embedding_status = 'VALID')::int AS valid,
      COUNT(*) FILTER (WHERE dc.embedding_status = 'PROCESSING')::int AS processing,
      COUNT(*) FILTER (WHERE dc.embedding_status = 'SKIPPED')::int AS skipped,
      COUNT(*) FILTER (
        WHERE dc.embedding_status IN ('PENDING','FAILED','INVALID')
          AND (dc.embedding_next_retry_at IS NULL OR dc.embedding_next_retry_at <= now())
      )::int AS due
    FROM document_chunks dc
    JOIN document_versions dv ON dv.id = dc.document_version_id
    WHERE dv.status = 'CURRENT'
  `);
  return rows[0];
}

async function triggerSchedule() {
  if (!N8N_API_KEY) return { ok: false, reason: 'no_api_key' };
  const res = await fetch(`${N8N_BASE}/api/v1/workflows/${SCHEDULE_ID}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

const history = [];
let start = await status();
history.push({ t: new Date().toISOString(), event: 'start', ...start });
console.log('start CURRENT', start);

if (!N8N_API_KEY) {
  console.log('N8N_API_KEY missing — write status only');
  fs.writeFileSync(
    outFile,
    JSON.stringify({ updatedAt: new Date().toISOString(), start, history, note: 'no_api_key' }, null, 2)
  );
  await client.end();
  process.exit(0);
}

for (let i = 1; i <= maxRounds; i++) {
  const before = await status();
  if (before.due === 0) {
    history.push({ t: new Date().toISOString(), event: 'done', round: i - 1, ...before });
    console.log('done', before);
    break;
  }
  const trig = await triggerSchedule();
  console.log(`round ${i}`, before, 'trigger', trig.ok ? trig.status : trig);
  // wait for run — poll due drop or timeout
  let after = before;
  for (let w = 0; w < 60; w++) {
    await new Promise((r) => setTimeout(r, 5000));
    after = await status();
    if (after.due < before.due || after.valid > before.valid) break;
  }
  history.push({
    t: new Date().toISOString(),
    event: 'round',
    round: i,
    before,
    after,
    triggerOk: trig.ok,
  });
  console.log(`after ${i}`, after);
  if (after.due === 0) break;
  if (after.due === before.due && after.valid === before.valid) {
    history.push({ t: new Date().toISOString(), event: 'stalled', ...after });
    console.log('stalled — stopping');
    break;
  }
}

const end = await status();
const payload = {
  updatedAt: new Date().toISOString(),
  start,
  end,
  history,
  scheduleId: SCHEDULE_ID,
};
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log('wrote', outFile, end);
await client.end();
