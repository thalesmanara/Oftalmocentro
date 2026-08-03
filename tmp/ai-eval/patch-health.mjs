import fs from 'fs';

let sql = fs.readFileSync('tmp/ai-eval/health-probe.sql', 'utf8');
if (!sql.includes('ai_eval_stats')) {
  sql = sql.replace(
    'tabular_stats AS (',
    `ai_eval_stats AS (
  SELECT
    (SELECT COUNT(*)::int FROM ai_test_cases WHERE status = 'active') AS cases_count,
    (SELECT overall_score FROM ai_test_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1) AS last_score,
    (SELECT started_at FROM ai_test_runs ORDER BY started_at DESC LIMIT 1) AS last_run_at,
    (SELECT status FROM ai_test_runs ORDER BY started_at DESC LIMIT 1) AS last_run_status,
    (SELECT avg_duration_ms FROM ai_test_metrics m
      JOIN ai_test_runs r ON r.id = m.run_id
      ORDER BY r.started_at DESC LIMIT 1) AS avg_duration_ms
),
tabular_stats AS (`
  );
  sql = sql.replace(
    `  tabular_stats.tabular_chunk_count
FROM t0`,
    `  tabular_stats.tabular_chunk_count,
  ai_eval_stats.cases_count AS ai_eval_cases_count,
  ai_eval_stats.last_score AS ai_eval_last_score,
  ai_eval_stats.last_run_at AS ai_eval_last_run_at,
  ai_eval_stats.last_run_status AS ai_eval_last_run_status,
  ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms
FROM t0`
  );
  sql = sql.replace(
    `CROSS JOIN tabular_stats
LEFT JOIN audit_probe ON true`,
    `CROSS JOIN tabular_stats
CROSS JOIN ai_eval_stats
LEFT JOIN audit_probe ON true`
  );
}
fs.writeFileSync('tmp/ai-eval/health-probe-patched.sql', sql);

let prep = fs.readFileSync('tmp/ai-eval/health-prepare.js', 'utf8');
if (!prep.includes('aiEvalDb')) {
  prep = prep.replace(
    `return [{
  json: {
    mode: String($('Trigger').first().json.mode || 'detailed'),
    _partial: {
      n8n: { status: 'ok', durationMs: 1 },
      database,
      configuration,
      sessions,
      audit,
      documents,
      backup,
      ocrDb,
      tabularDb,
    },`,
    `const aiEvalDb = dbFailed
  ? { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null }
  : {
      casesCount: Number(dbItem.ai_eval_cases_count ?? 0) || 0,
      lastScore: dbItem.ai_eval_last_score != null ? Number(dbItem.ai_eval_last_score) : null,
      lastRunAt: dbItem.ai_eval_last_run_at || null,
      lastRunStatus: dbItem.ai_eval_last_run_status || null,
      avgDurationMs: dbItem.ai_eval_avg_duration_ms != null ? Number(dbItem.ai_eval_avg_duration_ms) : null,
    };
return [{
  json: {
    mode: String($('Trigger').first().json.mode || 'detailed'),
    _partial: {
      n8n: { status: 'ok', durationMs: 1 },
      database,
      configuration,
      sessions,
      audit,
      documents,
      backup,
      ocrDb,
      tabularDb,
      aiEvalDb,
    },`
  );
}
fs.writeFileSync('tmp/ai-eval/health-prepare-patched.js', prep);

let agg = fs.readFileSync('tmp/ai-eval/health-aggregate.js', 'utf8');
if (!agg.includes('aiEval')) {
  agg = agg.replace(
    `  backup: partial.backup || { status: 'unknown', lastBackupAt: null, lastBackupStatus: null, lastBackupType: null },
};`,
    `  backup: partial.backup || { status: 'unknown', lastBackupAt: null, lastBackupStatus: null, lastBackupType: null },
  aiEval: (() => {
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
};`
  );
}
fs.writeFileSync('tmp/ai-eval/health-aggregate-patched.js', agg);

// Backup query patch helper
const backupExtraTables = `
    'ai_test_cases', (SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json) FROM ai_test_cases tc),
    'ai_test_runs', (SELECT COALESCE(json_agg(row_to_json(tr)), '[]'::json) FROM (SELECT * FROM ai_test_runs ORDER BY started_at DESC LIMIT 100) tr),
    'ai_test_results', (SELECT COALESCE(json_agg(row_to_json(tres)), '[]'::json) FROM (SELECT * FROM ai_test_results ORDER BY created_at DESC LIMIT 5000) tres),
    'ai_test_metrics', (SELECT COALESCE(json_agg(row_to_json(tm)), '[]'::json) FROM (SELECT * FROM ai_test_metrics ORDER BY created_at DESC LIMIT 100) tm),`;

const backupExtraCounts = `
    'ai_test_cases', (SELECT COUNT(*) FROM ai_test_cases),
    'ai_test_runs', (SELECT COUNT(*) FROM ai_test_runs),
    'ai_test_results', (SELECT COUNT(*) FROM ai_test_results),
    'ai_test_metrics', (SELECT COUNT(*) FROM ai_test_metrics),`;

fs.writeFileSync(
  'tmp/ai-eval/backup-patch.json',
  JSON.stringify({ backupExtraTables, backupExtraCounts }, null, 2)
);

console.log({
  sql: sql.includes('ai_eval_stats'),
  prep: prep.includes('aiEvalDb'),
  agg: agg.includes('aiEval'),
});
