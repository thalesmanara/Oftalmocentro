#!/usr/bin/env node
/**
 * Etapa 21.2 — add force to CWM trigger schema + wire health contextWindow from DB
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, '→', versionId);
  return versionId;
}

// 1) CWM: declare forceContextFailureForTest on trigger + ensure Montar throws + audit
const cwmVid = await bump('e95a92295d7c4deb', 'Declare forceContextFailureForTest on trigger inputs', (nodes) => {
  const trig = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const values = trig.parameters.workflowInputs.values;
  if (!values.some((v) => v.name === 'forceContextFailureForTest')) {
    values.push({ name: 'forceContextFailureForTest', type: 'string' });
  }

  // Ensure Preparar reads string/boolean
  const prep = nodes.find((n) => n.name === 'Preparar entrada');
  if (!prep.parameters.jsCode.includes('labForceContextFailure')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest===\'true\'),',
      `forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'),
  labForceContextFailure: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'),`,
    );
  }

  // Ensure audit on fallback exists — look for audit after montar
  const montar = nodes.find((n) => n.name === 'Montar janela');
  const code = montar.parameters.jsCode;
  if (!code.includes('TEST_INJECTED_CONTEXT_FAILURE')) {
    throw new Error('Montar missing inject');
  }
  // Make sure catch sets fallbackUsed and auditAction hint
  if (!code.includes('fallbackUsed:true') && !code.includes('fallbackUsed: true')) {
    console.warn('WARN: montar may not set fallbackUsed in catch — check manually');
  }
});

// 2) Health: extend Probe SQL + Prepare checks + Aggregate
const healthVid = await bump('qAyYc9DrHIqe4L9i', 'Health contextWindow from published config + fallback counts', (nodes) => {
  const probe = nodes.find((n) => n.name === 'Probe database');
  let sql = probe.parameters.query;
  if (!sql.includes('context_stats')) {
    // Insert context_stats CTE before retrieval_stats or after it
    const contextCte = `
context_stats AS (
  SELECT
    COALESCE(
      (SELECT value FROM app_secrets WHERE key='context_active_mode' LIMIT 1),
      (SELECT mode FROM ai_context_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),
      'LEGACY'
    ) AS context_mode,
    COALESCE(
      (SELECT value FROM app_secrets WHERE key='context_active_version' LIMIT 1),
      (SELECT version_label FROM ai_context_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),
      'context-v1'
    ) AS context_version,
    (SELECT COUNT(*)::int FROM ai_context_config_versions WHERE status='DRAFT') AS context_drafts,
    (SELECT COUNT(*)::int FROM ai_context_config_versions WHERE status='PUBLISHED') AS context_published,
    (
      SELECT COUNT(*)::int FROM ai_test_results
      WHERE context_fallback_used = true AND created_at > NOW() - INTERVAL '7 days'
    ) AS context_fallback_count,
    (
      SELECT COUNT(*)::int FROM audit_logs
      WHERE action = 'AI_CONTEXT_BUILD_FALLBACK' AND created_at > NOW() - INTERVAL '7 days'
    ) AS context_fallback_audit_count,
    (
      SELECT MAX(finished_at) FROM ai_test_runs
      WHERE context_config_version_id IS NOT NULL
    ) AS context_last_validation,
    (
      SELECT m.overall_score FROM ai_test_metrics m
      JOIN ai_test_runs r ON r.id = m.run_id
      WHERE r.context_config_version_id IS NOT NULL
      ORDER BY r.finished_at DESC NULLS LAST
      LIMIT 1
    ) AS context_last_score,
    (
      SELECT CASE
        WHEN (SELECT COUNT(*) FROM ai_context_config_versions WHERE status='PUBLISHED') <> 1 THEN false
        WHEN EXISTS (
          SELECT 1
          FROM app_secrets s
          JOIN ai_context_config_versions v ON v.status='PUBLISHED'
          WHERE s.key='context_active_version' AND s.value = v.version_label
        ) THEN true
        WHEN NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='context_active_version')
          AND (SELECT COUNT(*) FROM ai_context_config_versions WHERE status='PUBLISHED') = 1
        THEN true
        ELSE false
      END
    ) AS context_secrets_match,
    (
      SELECT COUNT(*)::int FROM ai_context_config_versions
      WHERE status IN ('DRAFT','PUBLISHED') AND (configuration IS NULL OR btrim(configuration::text) IN ('', '{}', 'null'))
    ) AS context_invalid_count
),`;

    if (sql.includes('retrieval_stats AS (')) {
      sql = sql.replace('retrieval_stats AS (', contextCte + '\nretrieval_stats AS (');
    } else {
      throw new Error('retrieval_stats CTE not found');
    }

    // Add SELECT columns before FROM t0
    if (!sql.includes('context_stats.context_mode')) {
      sql = sql.replace(
        'retrieval_stats.retrieval_last_validation,',
        `retrieval_stats.retrieval_last_validation,
  context_stats.context_mode,
  context_stats.context_version,
  context_stats.context_drafts,
  context_stats.context_published,
  context_stats.context_fallback_count,
  context_stats.context_fallback_audit_count,
  context_stats.context_last_validation,
  context_stats.context_last_score,
  context_stats.context_secrets_match,
  context_stats.context_invalid_count,`,
      );
      sql = sql.replace(
        'CROSS JOIN retrieval_stats',
        'CROSS JOIN retrieval_stats\nCROSS JOIN context_stats',
      );
    }
    probe.parameters.query = sql;
  }

  const prep = nodes.find((n) => n.name === 'Prepare checks');
  let pcode = prep.parameters.jsCode;
  if (!pcode.includes('contextDb')) {
    pcode = pcode.replace(
      'const retrievalDb = {',
      `const contextDb = {
      mode: dbItem.context_mode || 'LEGACY',
      version: dbItem.context_version || 'context-v1',
      drafts: Number(dbItem.context_drafts ?? 0) || 0,
      published: Number(dbItem.context_published ?? 0) || 0,
      fallbackCount: Math.max(Number(dbItem.context_fallback_count ?? 0) || 0, Number(dbItem.context_fallback_audit_count ?? 0) || 0),
      lastValidationAt: dbItem.context_last_validation || null,
      lastScore: dbItem.context_last_score != null ? Number(dbItem.context_last_score) : null,
      secretsMatch: dbItem.context_secrets_match === true || dbItem.context_secrets_match === 'true' || dbItem.context_secrets_match === 't',
      invalidCount: Number(dbItem.context_invalid_count ?? 0) || 0,
      available: true,
    };
const retrievalDb = {`,
    );
    pcode = pcode.replace(
      'retrievalDb,\n    },',
      'retrievalDb,\n      contextDb,\n    },',
    );
    prep.parameters.jsCode = pcode;
  }

  const agg = nodes.find((n) => n.name === 'Aggregate health');
  let acode = agg.parameters.jsCode;
  if (acode.includes("activeVersion: 'context-v1'")) {
    acode = acode.replace(
      /contextWindow: \(\(\) => \{[\s\S]*?draftCount: 1,\s*\};\s*\}\)\(\),/,
      `contextWindow: (() => {
    const c = partial.contextDb || {};
    const published = Number(c.published || 0);
    const secretsMatch = c.secretsMatch !== false;
    const multiple = published > 1;
    const fallbacks = Number(c.fallbackCount || 0);
    let status = 'ok';
    if (multiple || !secretsMatch || Number(c.invalidCount || 0) > 0) status = 'degraded';
    return {
      status,
      activeMode: c.mode || 'LEGACY',
      activeVersion: c.version || 'context-v1',
      modelName: 'gpt-4.1-mini',
      avgAvailableTokens: null,
      avgUsedTokens: null,
      avgUtilizationRate: null,
      avgIncludedChunks: null,
      avgExcludedChunks: null,
      overflowCount7d: 0,
      fallbackCount7d: fallbacks,
      failureCount7d: 0,
      insufficientContextCount7d: 0,
      avgBuildLatencyMs: null,
      lastDatasetValidation: c.lastValidationAt || null,
      lastValidationRun: c.lastValidationAt || null,
      lastValidationScore: c.lastScore != null ? Number(c.lastScore) : null,
      secretsMatchPublished: secretsMatch,
      multiplePublishedCount: Math.max(0, published > 1 ? published : 0),
      invalidConfigCount: Number(c.invalidCount || 0),
      draftCount: Number(c.drafts || 0),
    };
  })(),`,
    );
    agg.parameters.jsCode = acode;
  } else if (!acode.includes('partial.contextDb')) {
    console.warn('Aggregate pattern not matched — dumping snippet');
    const i = acode.indexOf('contextWindow');
    writeFileSync(new URL('./_c212-agg-cw-snip.js', import.meta.url), acode.slice(i, i + 800));
  }
});

writeFileSync(
  new URL('./_c212-publish-ids.json', import.meta.url),
  JSON.stringify({ cwmVid, healthVid, at: new Date().toISOString() }, null, 2),
);

await client.end();
console.log('done');
