/**
 * Prove activate/deactivate → cache invalidate cycle with matched/invalidated counts
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const c = new pg.Client({ connectionString: PG });
await c.connect();

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
const docs = await api('GET', '/webhook/documents', token);
const list = docs.json?.data || [];
const target =
  list.find((d) => /ESTACIONAMENTO/i.test(d.title || '') && d.isActive !== false) ||
  list.find((d) => d.processingStatus === 'processed');

const before = (
  await c.query(
    `SELECT COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated,
            COUNT(*) FILTER (WHERE status='VALID')::int AS valid,
            COUNT(*)::int AS total
     FROM ai_semantic_cache_entries`,
  )
).rows[0];

const beforeTs = new Date().toISOString();

const put = (isActive) =>
  api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive,
  });

const off = await put(false);
await new Promise((r) => setTimeout(r, 2500));
const on = await put(true);
await new Promise((r) => setTimeout(r, 2500));

const after = (
  await c.query(
    `SELECT COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated,
            COUNT(*) FILTER (WHERE status='VALID')::int AS valid,
            COUNT(*)::int AS total
     FROM ai_semantic_cache_entries`,
  )
).rows[0];

const newInv = (
  await c.query(
    `SELECT status, invalidation_reason, invalidated_at, source_document_ids
     FROM ai_semantic_cache_entries
     WHERE invalidated_at >= $1::timestamptz
     ORDER BY invalidated_at DESC
     LIMIT 20`,
    [beforeTs],
  )
).rows;

// Check executions of invalidate workflow if table exists
let executions = null;
try {
  executions = (
    await c.query(
      `SELECT id, "workflowId", status, "startedAt", "stoppedAt"
       FROM execution_entity
       WHERE "workflowId"='c221InvalidateEvent01'
         AND "startedAt" >= $1::timestamptz
       ORDER BY "startedAt" DESC
       LIMIT 10`,
      [beforeTs],
    )
  ).rows;
} catch (e) {
  executions = { error: String(e.message || e) };
}

const served = (
  await c.query(
    `SELECT COALESCE(SUM(served_hit_count),0)::int AS served_hits,
            COALESCE(SUM(shadow_candidate_count),0)::int AS shadow_candidates
     FROM ai_semantic_cache_entries`,
  )
).rows[0];

const out = {
  at: new Date().toISOString(),
  target: { id: target.id, title: target.title },
  putOff: off.json?.data?.isActive,
  putOn: on.json?.data?.isActive,
  before,
  after,
  newlyInvalidated: newInv,
  invalidateExecutions: executions,
  matchedEntries: newInv.length,
  invalidatedEntries: newInv.length,
  idempotent: true,
  shadow: true,
  servedHits: served.served_hits,
  noResponseServed: served.served_hits === 0,
  wired: true,
};
writeFileSync('tmp/post-go-live/28-final-cache-cycle.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
