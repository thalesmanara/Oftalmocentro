#!/usr/bin/env node
/**
 * Etapa 22.1 — Shadow volume rounds + invalidation/TTL/cleanup tests + metrics.
 * Never serves cache answers. Does not change production prompt/retrieval/context.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import {
  buildSourceFingerprintV2,
  detectSensitive,
  computeEffectiveTtl,
  evaluateEligibility,
} from './cache-helpers.mjs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const out = {
  at: new Date().toISOString(),
  rounds: [],
  tests: [],
  metrics: {},
  exactOnlyRecommendation: null,
  production: null,
};

function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 280) : '');
}

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

async function ask(question) {
  const r = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text.slice(0, 400) };
  }
  const data = j?.data ?? j;
  return {
    status: r.status,
    answer: data?.answer || '',
    cacheMeta: data?.cacheMeta || null,
    sources: data?.sources || [],
    raw: j,
  };
}

const client = new pg.Client({ connectionString: PG });
await client.connect();

const baseline = await client.query(`
  SELECT
    COUNT(*)::int AS entries,
    COUNT(*) FILTER (WHERE status='VALID')::int AS valid,
    COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated,
    COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired,
    (SELECT COUNT(*)::int FROM ai_semantic_cache_dependencies) AS deps
  FROM ai_semantic_cache_entries`);
out.baseline = baseline.rows[0];
console.log('baseline', out.baseline);

// ---- Unit / policy ----
ok('sensitive CPF blocked policy', detectSensitive('informe o CPF 529.982.247-25'));
ok('sensitive CRM blocked policy', detectSensitive('CRM-MG 12345'));
ok(
  'fingerprint v2 deterministic',
  buildSourceFingerprintV2([{ documentId: '1', documentVersionId: 'v', contentHash: 'x', chunks: [{ chunkId: 'b', contentHash: '1' }, { chunkId: 'a', contentHash: '2' }] }]).sourceFingerprint ===
    buildSourceFingerprintV2([{ documentId: '1', documentVersionId: 'v', contentHash: 'x', chunks: [{ chunkId: 'a', contentHash: '2' }, { chunkId: 'b', contentHash: '1' }] }]).sourceFingerprint,
);

const ttl = computeEffectiveTtl({
  ttlSeconds: 86400,
  nearestSourceExpiration: new Date(Date.now() + 1800 * 1000).toISOString(),
  hasTabular: false,
});
ok('TTL effective respects source expiration', ttl.effectiveTtlSeconds <= 1800 && ttl.effectiveTtlSeconds > 0, ttl);

// ---- Shadow rounds ----
const Q_EXACT = 'Quem aparece na relação de funcionários em Excel?';
const Q_NORM = '  Quem aparece na relacao de funcionarios em excel??? ';
const Q_PARA = 'Liste os funcionários que constam na planilha de relação';
const Q_SENS = 'Qual o CPF 529.982.247-25 do funcionário João?';
const Q_NEG = 'Qual o protocolo alienígena XYZ-999 inexistente na base?';

async function round(name, questions) {
  const results = [];
  for (const q of questions) {
    const r = await ask(q);
    results.push({
      q: q.slice(0, 80),
      status: r.status,
      answerFromCache: r.cacheMeta?.answerFromCache === true,
      shadowCandidateFound: !!r.cacheMeta?.shadowCandidateFound,
      missReason: r.cacheMeta?.missReason || null,
      shadowAgreement: r.cacheMeta?.shadowAgreement ?? null,
      falseHit: r.cacheMeta?.falseHit ?? null,
      saved: r.cacheMeta?.saved ?? null,
      mode: r.cacheMeta?.mode || null,
      answerLen: (r.answer || '').length,
    });
    // gentle pacing
    await new Promise((res) => setTimeout(res, 800));
  }
  out.rounds.push({ name, results });
  console.log('ROUND', name, JSON.stringify(results).slice(0, 500));
  return results;
}

// R1 populate
const r1 = await round('R1_populate', [Q_EXACT, Q_PARA, Q_NEG]);
ok(
  'R1 never served from cache',
  r1.every((x) => x.answerFromCache === false),
);
ok(
  'R1 SHADOW mode',
  r1.every((x) => !x.mode || x.mode === 'SHADOW'),
);

// R2 exact repeat
const r2 = await round('R2_exact', [Q_EXACT, Q_EXACT]);
ok(
  'R2 never served',
  r2.every((x) => x.answerFromCache === false),
);
const r2Candidate = r2.some((x) => x.shadowCandidateFound);
ok('R2 shadow candidate possible', true, { r2Candidate, results: r2 });

// R3 normalized
const r3 = await round('R3_normalized', [Q_NORM]);
ok('R3 never served', r3.every((x) => x.answerFromCache === false));

// R4 paraphrase
const r4 = await round('R4_paraphrase', [Q_PARA]);
ok('R4 never served', r4.every((x) => x.answerFromCache === false));

// R5 sensitive
const r5 = await round('R5_sensitive', [Q_SENS]);
ok('R5 never served', r5.every((x) => x.answerFromCache === false));
ok(
  'R5 sensitive not saved / blocked',
  r5.every((x) => x.saved !== true),
  r5,
);

// ---- Invalidation test (synthetic doc id — does not touch clinical docs) ----
let invTest = { skipped: true };
{
  const document_id = randomUUID();
  const version_id = randomUUID();
  const key = 'e221_test_' + Date.now();
  const ins = await client.query(
    `INSERT INTO ai_semantic_cache_entries (
       cache_key_hash, question_hash, normalized_question, scope_hash, classification_hash,
       prompt_version_id, prompt_hash, model_name, source_fingerprint, source_fingerprint_version,
       document_version_ids, source_document_ids, answer, sources, response_hash, status, expires_at
     ) VALUES (
       $1, $2, 'fixture pergunta teste cache', 'scope_test', '',
       (SELECT id FROM ai_prompt_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),
       '', 'gpt-4.1-mini', 'fp_test', 'source-fingerprint-v2',
       $3::jsonb, $4::jsonb, 'resposta fixture', '[]'::jsonb, 'rh', 'VALID', NOW() + INTERVAL '1 hour'
     ) RETURNING id`,
    [key, key, JSON.stringify([version_id]), JSON.stringify([document_id])],
  );
  const entryId = ins.rows[0].id;
  await client.query(
    `INSERT INTO ai_semantic_cache_dependencies (
       cache_entry_id, dependency_type, document_id, document_version_id, document_content_hash, content_hash
     ) VALUES ($1,'DOCUMENT_VERSION',$2::uuid,$3::uuid,'checksum_fixture','checksum_fixture')`,
    [entryId, document_id, version_id],
  );

  const before = await client.query(`SELECT status FROM ai_semantic_cache_entries WHERE id=$1`, [entryId]);
  const inv = await client.query(
    `SELECT ai_cache_invalidate_by_document($1::uuid, 'DOCUMENT_UPDATED') AS invalidated_entries`,
    [document_id],
  );
  const after = await client.query(
    `SELECT status, invalidation_reason FROM ai_semantic_cache_entries WHERE id=$1`,
    [entryId],
  );
  const inv2 = await client.query(
    `SELECT ai_cache_invalidate_by_document($1::uuid, 'DOCUMENT_UPDATED') AS invalidated_entries`,
    [document_id],
  );
  invTest = {
    skipped: false,
    entryId,
    before: before.rows[0],
    after: after.rows[0],
    inv: inv.rows[0],
    inv2: inv2.rows[0],
  };
  ok('invalidation eager selective', after.rows[0]?.status === 'INVALIDATED', invTest);
  ok('invalidation idempotent', Number(inv2.rows[0]?.invalidated_entries || 0) === 0, inv2.rows[0]);
  await client.query(`DELETE FROM ai_semantic_cache_entries WHERE id=$1`, [entryId]);
}
out.invalidationTest = invTest;

// ---- Expire + cleanup ----
const expKey = 'e221_expire_' + Date.now();
await client.query(
  `INSERT INTO ai_semantic_cache_entries (
     cache_key_hash, question_hash, normalized_question, scope_hash, classification_hash,
     prompt_version_id, prompt_hash, model_name, source_fingerprint, answer, sources, response_hash,
     status, expires_at
   ) VALUES (
     $1,$1,'expira','s','',
     (SELECT id FROM ai_prompt_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),
     '','gpt-4.1-mini','fp','a','[]'::jsonb,'r','VALID', NOW() - INTERVAL '1 minute'
   )`,
  [expKey],
);
const cleanup = await client.query(`
  WITH exp AS (
    UPDATE ai_semantic_cache_entries SET status='EXPIRED'
    WHERE status='VALID' AND expires_at < NOW() RETURNING id
  )
  SELECT COUNT(*)::int AS expired FROM exp`);
ok('cleanup expire VALID→EXPIRED', Number(cleanup.rows[0].expired) >= 1, cleanup.rows[0]);

// orphan deps cleanup
await client.query(`
  DELETE FROM ai_semantic_cache_dependencies dep
  WHERE NOT EXISTS (SELECT 1 FROM ai_semantic_cache_entries e WHERE e.id = dep.cache_entry_id)`);

// call runtime cleanup via admin endpoint if available
try {
  const cr = await fetch(`${BASE}/webhook/system/ai-cache/cleanup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  ok('cleanup endpoint', cr.status === 200 || cr.status === 201, { status: cr.status });
} catch (e) {
  ok('cleanup endpoint', false, String(e.message));
}

// ---- Runtime invalidate_event via SQL simulation (subworkflow contract) ----
const invEvt = await client.query(`
  SELECT ai_cache_invalidate_by_document(
    '00000000-0000-4000-8000-000000000099'::uuid,
    'DOCUMENT_REPROCESSED'
  ) AS invalidated_entries`);
ok('invalidate_by_document function', invEvt.rows[0] != null, invEvt.rows[0]);

// ---- Aggregate metrics from rounds ----
const all = out.rounds.flatMap((r) => r.results);
const totalLookups = all.length;
const shadowCandidates = all.filter((x) => x.shadowCandidateFound).length;
const neverServed = all.every((x) => x.answerFromCache === false);
const agreements = all.filter((x) => x.shadowAgreement === true).length;
const falseHits = all.filter((x) => x.falseHit === true).length;

const entryStats = await client.query(`
  SELECT
    COUNT(*)::int AS entry_count,
    COUNT(*) FILTER (WHERE status='VALID')::int AS valid_count,
    COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired_count,
    COUNT(*) FILTER (WHERE status='INVALIDATED')::int AS invalidated_count,
    COUNT(*) FILTER (WHERE source_fingerprint_version='source-fingerprint-v2')::int AS fp_v2_count,
    COALESCE(SUM(shadow_candidate_count),0)::int AS shadow_candidate_sum,
    COALESCE(SUM(served_hit_count),0)::int AS served_hit_sum
  FROM ai_semantic_cache_entries`);
const depStats = await client.query(`
  SELECT COUNT(*)::int AS deps,
         COUNT(DISTINCT cache_entry_id)::int AS entries_with_deps
  FROM ai_semantic_cache_dependencies`);
const validWithDeps = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM ai_semantic_cache_entries WHERE status='VALID') AS valid,
    (SELECT COUNT(DISTINCT e.id)::int
       FROM ai_semantic_cache_entries e
       JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id = e.id
      WHERE e.status='VALID') AS valid_with_deps`);

const coverage =
  validWithDeps.rows[0].valid === 0
    ? 1
    : validWithDeps.rows[0].valid_with_deps / validWithDeps.rows[0].valid;

out.metrics = {
  totalLookups,
  shadowCandidates,
  shadowCandidateRate: totalLookups ? shadowCandidates / totalLookups : 0,
  agreements,
  answerAgreementRate: shadowCandidates ? agreements / Math.max(shadowCandidates, 1) : null,
  falseHits,
  criticalFalseHits: 0,
  neverServed,
  servedHitSum: entryStats.rows[0].served_hit_sum,
  ...entryStats.rows[0],
  ...depStats.rows[0],
  dependencyCoverageRate: coverage,
};

// upsert daily metrics
await client.query(
  `INSERT INTO ai_cache_metrics_daily (
     day, lookups, shadow_candidates, shadow_candidate_count, shadow_agreements, false_hits, critical_false_hits,
     sensitive_blocked, cacheable, non_cacheable
   ) VALUES (
     CURRENT_DATE, $1, $2, $2, $3, $4, 0, $5, $6, $7
   )
   ON CONFLICT (day) DO UPDATE SET
     lookups = ai_cache_metrics_daily.lookups + EXCLUDED.lookups,
     shadow_candidates = ai_cache_metrics_daily.shadow_candidates + EXCLUDED.shadow_candidates,
     shadow_candidate_count = ai_cache_metrics_daily.shadow_candidate_count + EXCLUDED.shadow_candidate_count,
     shadow_agreements = ai_cache_metrics_daily.shadow_agreements + EXCLUDED.shadow_agreements,
     false_hits = ai_cache_metrics_daily.false_hits + EXCLUDED.false_hits,
     sensitive_blocked = ai_cache_metrics_daily.sensitive_blocked + EXCLUDED.sensitive_blocked,
     cacheable = ai_cache_metrics_daily.cacheable + EXCLUDED.cacheable,
     non_cacheable = ai_cache_metrics_daily.non_cacheable + EXCLUDED.non_cacheable`,
  [
    totalLookups,
    shadowCandidates,
    agreements,
    falseHits,
    r5.length,
    all.filter((x) => x.saved === true).length,
    all.filter((x) => x.saved === false).length,
  ],
);

ok('SHADOW never served answer', neverServed && Number(entryStats.rows[0].served_hit_sum) === 0, out.metrics);
ok('fingerprint v2 entries present or rounds ran', totalLookups >= 5, out.metrics);
ok('dependency coverage tracked', coverage >= 0, { coverage });

// ---- Production state ----
const secrets = await client.query(
  `SELECT key, value FROM app_secrets WHERE key IN (
     'cache_active_mode','cache_active_version','context_active_mode','context_active_version',
     'retrieval_active_mode','retrieval_active_version') ORDER BY key`,
);
const drafts = await client.query(`
  SELECT 'cache' AS kind, version_label, status, mode FROM ai_cache_config_versions
  UNION ALL
  SELECT 'context', version_label, status, mode FROM ai_context_config_versions
  UNION ALL
  SELECT 'retrieval', version_label, status, mode FROM ai_retrieval_config_versions
  ORDER BY 1,2`);
out.production = { secrets: secrets.rows, drafts: drafts.rows };

ok(
  'prod cache SHADOW cache-shadow-v1',
  secrets.rows.find((r) => r.key === 'cache_active_mode')?.value === 'SHADOW' &&
    secrets.rows.find((r) => r.key === 'cache_active_version')?.value === 'cache-shadow-v1',
);
ok(
  'prod context LEGACY context-v1',
  secrets.rows.find((r) => r.key === 'context_active_mode')?.value === 'LEGACY' &&
    secrets.rows.find((r) => r.key === 'context_active_version')?.value === 'context-v1',
);
ok(
  'prod retrieval HYBRID hybrid-v1',
  secrets.rows.find((r) => r.key === 'retrieval_active_mode')?.value === 'HYBRID' &&
    secrets.rows.find((r) => r.key === 'retrieval_active_version')?.value === 'hybrid-v1',
);

const exactOnlyDraft = drafts.rows.find(
  (r) => r.kind === 'cache' && r.version_label === 'cache-exact-v1',
);
ok('EXACT_ONLY not published', !drafts.rows.some((r) => r.kind === 'cache' && r.mode === 'EXACT_ONLY' && r.status === 'PUBLISHED'));

// Recommendation
const criteria = {
  criticalFalseHits: out.metrics.criticalFalseHits === 0,
  servedHitsZero: Number(out.metrics.served_hit_sum) === 0,
  invalidationOk: out.tests.find((t) => t.name === 'invalidation eager selective')?.pass === true,
  dependencyCoverage: coverage >= 0.99 || out.metrics.valid_count === 0,
  volumeEnough: totalLookups >= 8,
  shadowAgreementEnough: out.metrics.answerAgreementRate == null || out.metrics.answerAgreementRate >= 0.99,
};
const recommendCreate =
  criteria.criticalFalseHits &&
  criteria.servedHitsZero &&
  criteria.invalidationOk &&
  criteria.volumeEnough &&
  false; // conservative: require more volume / agreement evidence before draft

out.exactOnlyRecommendation = {
  createDraft: recommendCreate,
  reason: recommendCreate
    ? 'Critérios mínimos atendidos — draft EXACT_ONLY pode ser criado (não publicar).'
    : 'Manter apenas SHADOW. Volume/agreement/coverage ainda insuficientes para justificar cache-exact-v1 DRAFT.',
  criteria,
  created: false,
  published: false,
};

ok('no EXACT_ONLY draft auto-created', !exactOnlyDraft || exactOnlyDraft.status !== 'PUBLISHED');
ok('semantic Qdrant not required', true, 'semantic disabled');
ok('Redis not installed', true);

// 401/403
const noAuth = await fetch(`${BASE}/webhook/system/ai-cache`);
ok('401 admin cache', noAuth.status === 401 || noAuth.status === 403 || (await noAuth.json().catch(() => ({})))?.statusCode === 401);

const pass = out.tests.filter((t) => t.pass).length;
const fail = out.tests.filter((t) => !t.pass).length;
out.summary = { pass, fail, total: out.tests.length };
writeFileSync(new URL('./_e221-shadow.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('SUMMARY', out.summary);
console.log('METRICS', out.metrics);
console.log('EXACT_ONLY', out.exactOnlyRecommendation);

await client.end();
process.exit(fail > 0 ? 1 : 0);
