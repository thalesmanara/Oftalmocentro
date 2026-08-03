#!/usr/bin/env node
/**
 * Patch health for semanticCache + ensure production SHADOW.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(`SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

// Ensure secrets + single published shadow
await client.query(`UPDATE app_secrets SET value='SHADOW', updated_at=NOW() WHERE key='cache_active_mode'`);
await client.query(`UPDATE app_secrets SET value='cache-shadow-v1', updated_at=NOW() WHERE key='cache_active_version'`);
await client.query(`UPDATE ai_cache_config_versions SET status='ARCHIVED', archived_at=NOW() WHERE status='PUBLISHED' AND version_label<>'cache-shadow-v1'`);
await client.query(`UPDATE ai_cache_config_versions SET status='PUBLISHED', published_at=COALESCE(published_at,NOW()) WHERE version_label='cache-shadow-v1'`);

const healthVid = await bump('qAyYc9DrHIqe4L9i', 'Add semanticCache health component', (nodes) => {
  const probe = nodes.find((n) => n.name === 'Probe database');
  let sql = probe.parameters.query;
  if (!sql.includes('cache_stats')) {
    const cte = `
cache_stats AS (
  SELECT
    COALESCE((SELECT value FROM app_secrets WHERE key='cache_active_mode' LIMIT 1),'SHADOW') AS cache_mode,
    COALESCE((SELECT value FROM app_secrets WHERE key='cache_active_version' LIMIT 1),'cache-shadow-v1') AS cache_version,
    (SELECT COUNT(*)::int FROM ai_cache_config_versions WHERE status='DRAFT') AS cache_drafts,
    (SELECT COUNT(*)::int FROM ai_cache_config_versions WHERE status='PUBLISHED') AS cache_published,
    (SELECT COUNT(*)::int FROM ai_semantic_cache_entries) AS cache_entry_count,
    (SELECT COUNT(*)::int FROM ai_semantic_cache_entries WHERE status='VALID') AS cache_valid_count,
    (SELECT COUNT(*)::int FROM ai_semantic_cache_entries WHERE status='EXPIRED') AS cache_expired_count,
    (SELECT COUNT(*)::int FROM ai_semantic_cache_entries WHERE status='INVALIDATED') AS cache_invalidated_count,
    (SELECT COALESCE(SUM(hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_hits_7d,
    (SELECT COALESCE(SUM(lookups),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_lookups_7d,
    (SELECT COALESCE(SUM(false_hits),0)::bigint FROM ai_cache_metrics_daily WHERE day >= CURRENT_DATE - 7) AS cache_false_hits_7d,
    (
      SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM app_secrets s
          JOIN ai_cache_config_versions v ON v.status='PUBLISHED'
          WHERE s.key='cache_active_version' AND s.value=v.version_label
        ) THEN true ELSE false END
    ) AS cache_secrets_match
),`;
    sql = sql.replace('retrieval_stats AS (', cte + '\nretrieval_stats AS (');
    sql = sql.replace(
      'retrieval_stats.retrieval_last_validation,',
      `retrieval_stats.retrieval_last_validation,
  cache_stats.cache_mode,
  cache_stats.cache_version,
  cache_stats.cache_drafts,
  cache_stats.cache_published,
  cache_stats.cache_entry_count,
  cache_stats.cache_valid_count,
  cache_stats.cache_expired_count,
  cache_stats.cache_invalidated_count,
  cache_stats.cache_hits_7d,
  cache_stats.cache_lookups_7d,
  cache_stats.cache_false_hits_7d,
  cache_stats.cache_secrets_match,`,
    );
    sql = sql.replace('CROSS JOIN retrieval_stats', 'CROSS JOIN retrieval_stats\nCROSS JOIN cache_stats');
    probe.parameters.query = sql;
  }

  const prep = nodes.find((n) => n.name === 'Prepare checks');
  if (!prep.parameters.jsCode.includes('cacheDb')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'const retrievalDb = {',
      `const cacheDb = {
      mode: dbItem.cache_mode || 'SHADOW',
      version: dbItem.cache_version || 'cache-shadow-v1',
      drafts: Number(dbItem.cache_drafts ?? 0) || 0,
      published: Number(dbItem.cache_published ?? 0) || 0,
      entryCount: Number(dbItem.cache_entry_count ?? 0) || 0,
      validCount: Number(dbItem.cache_valid_count ?? 0) || 0,
      expiredCount: Number(dbItem.cache_expired_count ?? 0) || 0,
      invalidatedCount: Number(dbItem.cache_invalidated_count ?? 0) || 0,
      hits7d: Number(dbItem.cache_hits_7d ?? 0) || 0,
      lookups7d: Number(dbItem.cache_lookups_7d ?? 0) || 0,
      falseHits7d: Number(dbItem.cache_false_hits_7d ?? 0) || 0,
      secretsMatch: dbItem.cache_secrets_match === true || dbItem.cache_secrets_match === 't' || dbItem.cache_secrets_match === 'true',
      available: true,
    };
const retrievalDb = {`,
    );
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'retrievalDb,\n      contextDb,\n    },',
      'retrievalDb,\n      contextDb,\n      cacheDb,\n    },',
    );
    if (!prep.parameters.jsCode.includes('cacheDb,')) {
      prep.parameters.jsCode = prep.parameters.jsCode.replace('retrievalDb,', 'retrievalDb,\n      cacheDb,');
    }
  }

  const agg = nodes.find((n) => n.name === 'Aggregate health');
  if (!agg.parameters.jsCode.includes('semanticCache:')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      'contextWindow: (() => {',
      `semanticCache: (() => {
    const c = partial.cacheDb || {};
    const published = Number(c.published || 0);
    const secretsMatch = c.secretsMatch !== false;
    const falseHits = Number(c.falseHits7d || 0);
    let status = 'ok';
    if (published > 1 || !secretsMatch || falseHits > 0) status = 'degraded';
    const lookups = Number(c.lookups7d || 0);
    const hits = Number(c.hits7d || 0);
    return {
      status,
      activeMode: c.mode || 'SHADOW',
      activeVersion: c.version || 'cache-shadow-v1',
      entryCount: Number(c.entryCount || 0),
      validCount: Number(c.validCount || 0),
      expiredCount: Number(c.expiredCount || 0),
      invalidatedCount: Number(c.invalidatedCount || 0),
      hitRate7d: lookups > 0 ? hits / lookups : 0,
      exactHitRate7d: lookups > 0 ? hits / lookups : 0,
      semanticHitRate7d: 0,
      falseHitCount7d: falseHits,
      lookupLatencyAvgMs: null,
      estimatedTokensSaved7d: 0,
      estimatedCostSaved7d: 0,
      estimatedLatencySaved7d: 0,
      invalidationFailures7d: 0,
      qdrantIndexAvailable: false,
      lastCleanupAt: null,
      lastValidationRun: null,
      draftCount: Number(c.drafts || 0),
      secretsMatchPublished: secretsMatch,
      multiplePublishedCount: Math.max(0, published > 1 ? published : 0),
    };
  })(),
  contextWindow: (() => {`,
    );
  }
});

// GET System Health allowlist
await bump('2UPHcxASp2PboC9M', 'Allow semanticCache in health response', (nodes) => {
  const n = nodes.find((x) => x.name === 'Montar resposta admin');
  if (!n) return;
  if (!n.parameters.jsCode.includes("'semanticCache'")) {
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "'contextWindow']",
      "'contextWindow','semanticCache']",
    );
  }
  if (!n.parameters.jsCode.includes("key === 'semanticCache'")) {
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "if (key === 'contextWindow') {",
      `if (key === 'semanticCache') {
    out.activeMode = c.activeMode || null;
    out.activeVersion = c.activeVersion || null;
    out.entryCount = Number(c.entryCount || 0) || 0;
    out.validCount = Number(c.validCount || 0) || 0;
    out.expiredCount = Number(c.expiredCount || 0) || 0;
    out.invalidatedCount = Number(c.invalidatedCount || 0) || 0;
    out.hitRate7d = c.hitRate7d != null ? Number(c.hitRate7d) : 0;
    out.exactHitRate7d = c.exactHitRate7d != null ? Number(c.exactHitRate7d) : 0;
    out.semanticHitRate7d = c.semanticHitRate7d != null ? Number(c.semanticHitRate7d) : 0;
    out.falseHitCount7d = Number(c.falseHitCount7d || 0) || 0;
    out.qdrantIndexAvailable = c.qdrantIndexAvailable === true;
    out.draftCount = Number(c.draftCount || 0) || 0;
    out.secretsMatchPublished = c.secretsMatchPublished !== false;
    out.multiplePublishedCount = Number(c.multiplePublishedCount || 0) || 0;
  }
if (key === 'contextWindow') {`,
    );
  }
});

await client.end();
console.log('health patched', healthVid);
