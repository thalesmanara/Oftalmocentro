import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));

let sql = readFileSync(join(dir, '_health-Probe_database.sql'), 'utf8');

const cte = `ai_prompt_stats AS (
  SELECT
    pub.version_number AS ai_prompt_version_number,
    pub.model_name AS ai_prompt_model_name,
    pub.published_at AS ai_prompt_published_at,
    pub.validation_score AS ai_prompt_validation_score,
    (SELECT COUNT(*)::int FROM ai_prompt_versions v WHERE v.prompt_definition_id = d.id AND v.status IN ('DRAFT','VALIDATING')) AS ai_prompt_draft_count,
    (SELECT COUNT(*)::int FROM ai_prompt_versions v WHERE v.prompt_definition_id = d.id AND v.status = 'PUBLISHED') AS ai_prompt_published_count
  FROM ai_prompt_definitions d
  LEFT JOIN LATERAL (
    SELECT version_number, model_name, published_at, validation_score
    FROM ai_prompt_versions v
    WHERE v.prompt_definition_id = d.id AND v.status = 'PUBLISHED' AND v.environment = 'PRODUCTION'
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT 1
  ) pub ON true
  WHERE d.code = 'AI_QUERY_MAIN'
  LIMIT 1
),
`;

if (!sql.includes('ai_prompt_stats')) {
  sql = sql.replace('tabular_stats AS (', cte + 'tabular_stats AS (');
  sql = sql.replace(
    'ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms\nFROM t0',
    `ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms,
  ai_prompt_stats.ai_prompt_version_number,
  ai_prompt_stats.ai_prompt_model_name,
  ai_prompt_stats.ai_prompt_published_at,
  ai_prompt_stats.ai_prompt_validation_score,
  ai_prompt_stats.ai_prompt_draft_count,
  ai_prompt_stats.ai_prompt_published_count
FROM t0`
  );
  sql = sql.replace('CROSS JOIN ai_eval_stats\n', 'CROSS JOIN ai_eval_stats\nLEFT JOIN ai_prompt_stats ON true\n');
}

writeFileSync(join(dir, '_patched-Probe_database.sql'), sql);

let prepare = readFileSync(join(dir, '_health-Prepare_checks.js'), 'utf8');
if (!prepare.includes('aiPromptsDb')) {
  prepare = prepare.replace(
    `const aiEvalDb = dbFailed
  ? { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null }
  : {
      casesCount: Number(dbItem.ai_eval_cases_count ?? 0) || 0,
      lastScore: dbItem.ai_eval_last_score != null ? Number(dbItem.ai_eval_last_score) : null,
      lastRunAt: dbItem.ai_eval_last_run_at || null,
      lastRunStatus: dbItem.ai_eval_last_run_status || null,
      avgDurationMs: dbItem.ai_eval_avg_duration_ms != null ? Number(dbItem.ai_eval_avg_duration_ms) : null,
    };
return [{`,
    `const aiEvalDb = dbFailed
  ? { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null }
  : {
      casesCount: Number(dbItem.ai_eval_cases_count ?? 0) || 0,
      lastScore: dbItem.ai_eval_last_score != null ? Number(dbItem.ai_eval_last_score) : null,
      lastRunAt: dbItem.ai_eval_last_run_at || null,
      lastRunStatus: dbItem.ai_eval_last_run_status || null,
      avgDurationMs: dbItem.ai_eval_avg_duration_ms != null ? Number(dbItem.ai_eval_avg_duration_ms) : null,
    };
const draftCount = Number(dbItem.ai_prompt_draft_count ?? 0) || 0;
const publishedCount = Number(dbItem.ai_prompt_published_count ?? 0) || 0;
const missingPublished = dbItem.ai_prompt_version_number == null;
const multiplePublished = publishedCount > 1;
const aiPromptsDb = dbFailed
  ? { status: 'down', versionNumber: null, modelName: null, publishedAt: null, validationScore: null, draftCount: 0, publishedCount: 0, missingPublished: true, multiplePublished: false }
  : {
      status: missingPublished || multiplePublished ? 'degraded' : 'ok',
      versionNumber: dbItem.ai_prompt_version_number != null ? Number(dbItem.ai_prompt_version_number) : null,
      modelName: dbItem.ai_prompt_model_name || null,
      publishedAt: dbItem.ai_prompt_published_at || null,
      validationScore: dbItem.ai_prompt_validation_score != null ? Number(dbItem.ai_prompt_validation_score) : null,
      draftCount,
      publishedCount,
      missingPublished,
      multiplePublished,
    };
return [{`
  );
  prepare = prepare.replace(
    `      aiEvalDb,
    },`,
    `      aiEvalDb,
      aiPromptsDb,
    },`
  );
}
writeFileSync(join(dir, '_patched-Prepare_checks.js'), prepare);

let agg = readFileSync(join(dir, '_health-Aggregate_health.js'), 'utf8');
if (!agg.includes('aiPrompts:')) {
  agg = agg.replace(
    `  aiEval: (() => {
    const a = partial.aiEvalDb || { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null };
    const status = a.casesCount > 0 ? 'ok' : 'degraded';
    return {
      status,
      casesCount: a.casesCount,
      lastScore: a.lastScore,
      lastRunAt: a.lastRunAt,
      lastRunStatus: a.lastRunStatus,
      avgDurationMs: a.avgDurationMs,
    };
  })(),
};`,
    `  aiEval: (() => {
    const a = partial.aiEvalDb || { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null };
    const status = a.casesCount > 0 ? 'ok' : 'degraded';
    return {
      status,
      casesCount: a.casesCount,
      lastScore: a.lastScore,
      lastRunAt: a.lastRunAt,
      lastRunStatus: a.lastRunStatus,
      avgDurationMs: a.avgDurationMs,
    };
  })(),
  aiPrompts: (() => {
    const a = partial.aiPromptsDb || { status: 'degraded', versionNumber: null, modelName: null, publishedAt: null, validationScore: null, draftCount: 0, publishedCount: 0, missingPublished: true, multiplePublished: false };
    return {
      status: a.status || 'degraded',
      versionNumber: a.versionNumber,
      modelName: a.modelName,
      publishedAt: a.publishedAt,
      validationScore: a.validationScore,
      draftCount: Number(a.draftCount || 0) || 0,
      publishedCount: Number(a.publishedCount || 0) || 0,
      missingPublished: !!a.missingPublished,
      multiplePublished: !!a.multiplePublished,
    };
  })(),
};`
  );
}
writeFileSync(join(dir, '_patched-Aggregate_health.js'), agg);

console.log('SQL len', sql.length, 'has ai_prompt', sql.includes('ai_prompt_stats'));
console.log('Prepare has aiPromptsDb', prepare.includes('aiPromptsDb'));
console.log('Agg has aiPrompts', agg.includes('aiPrompts:'));
