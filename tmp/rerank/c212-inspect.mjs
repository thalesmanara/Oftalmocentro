#!/usr/bin/env node
/**
 * Etapa 21.2 — Inspect FAILED status root cause + production baseline.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const out = { at: new Date().toISOString(), workflows: {}, inconsistentRuns: [], production: {} };

// Workflows of interest
const wfNames = [
  'IA - EXECUTAR TESTE',
  'IA - EXECUTAR DATASET',
  'IA - CALCULAR MÉTRICAS',
  'CALCULAR MÉTRICAS',
  'FINALIZAR',
  'IA - GERENCIAR JANELA DE CONTEXTO',
  'Consulta IA',
  'SYSTEM - AI CONTEXT PUBLISH',
  'SYSTEM - AI CONTEXT ROLLBACK',
];
const wfs = await client.query(
  `SELECT id, name, active, "activeVersionId", "versionId"
   FROM workflow_entity
   WHERE name ILIKE ANY($1) OR name ILIKE '%métric%' OR name ILIKE '%metric%' OR name ILIKE '%finaliz%' OR name ILIKE '%atualizar run%'
   ORDER BY name`,
  [wfNames.map((n) => `%${n.replace(/IA - /, '')}%`)],
);
out.workflows.list = wfs.rows;

// Known IDs
const known = {
  executarTeste: 'KdpEmEGHNlPICOa4',
  executarDataset: '12t0Ol6zWQJgAKPC',
  cwm: 'e95a92295d7c4deb',
  consulta: '8EXk5RkFW5cxnenL',
  publish: 'f83073bfb4154115',
  rollback: '708bf587fb73467f',
};

for (const [k, id] of Object.entries(known)) {
  const r = await client.query(
    `SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  out.workflows[k] = r.rows[0] || { missing: id };
}

// Inconsistent runs: FAILED but has results / passed
const inconsist = await client.query(`
  SELECT r.id, r.status, r.total_cases, r.passed_count, r.failed_count, r.error_count, r.skipped_count,
         r.overall_score, r.trigger_mode, r.started_at, r.finished_at,
         (SELECT COUNT(*)::int FROM ai_test_results x WHERE x.run_id=r.id) AS result_count,
         (SELECT COUNT(*)::int FROM ai_test_metrics m WHERE m.run_id=r.id) AS metrics_count,
         (SELECT COUNT(*)::int FROM ai_test_results x WHERE x.run_id=r.id AND x.verdict='PASS') AS pass_results,
         (SELECT COUNT(*)::int FROM ai_test_results x WHERE x.run_id=r.id AND x.verdict='FAIL') AS fail_results,
         (SELECT COUNT(*)::int FROM ai_test_results x WHERE x.run_id=r.id AND x.verdict='ERROR') AS error_results
  FROM ai_test_runs r
  WHERE r.started_at > NOW() - INTERVAL '7 days'
    AND (
      (r.status = 'FAILED' AND EXISTS (SELECT 1 FROM ai_test_results x WHERE x.run_id=r.id))
      OR (r.status = 'FAILED' AND COALESCE(r.passed_count,0) > 0)
      OR (r.status = 'SUCCESS' AND COALESCE(r.error_count,0) > 0)
    )
  ORDER BY r.started_at DESC
  LIMIT 30
`);
out.inconsistentRuns = inconsist.rows;
console.log('inconsistent runs', inconsist.rows.length);
for (const row of inconsist.rows.slice(0, 8)) {
  console.log(JSON.stringify(row));
}

// Dump EXECUTAR DATASET nodes related to status
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [
    known.executarDataset,
  ]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const interesting = nodes.filter((n) =>
    /atualiz|final|status|métric|metric|resumo|report|calcular|completar/i.test(n.name || ''),
  );
  out.workflows.datasetStatusNodes = interesting.map((n) => ({
    name: n.name,
    type: n.type,
    hasQuery: !!n.parameters?.query,
    codeLen: n.parameters?.jsCode?.length || 0,
  }));
  for (const n of interesting) {
    const file = `tmp/rerank/_c212-ds-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    const content = n.parameters?.query || n.parameters?.jsCode || JSON.stringify(n.parameters, null, 2);
    writeFileSync(file, content);
    console.log('wrote', file, n.name);
  }
}

// Also EXECUTAR TESTE finalizer
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [
    known.executarTeste,
  ]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const interesting = nodes.filter((n) =>
    /atualiz|final|status|métric|metric|resumo|report|completar/i.test(n.name || ''),
  );
  out.workflows.testeStatusNodes = interesting.map((n) => n.name);
  for (const n of interesting) {
    const file = `tmp/rerank/_c212-te-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    writeFileSync(file, n.parameters?.query || n.parameters?.jsCode || '');
    console.log('wrote', file);
  }
}

// Find CALCULAR MÉTRICAS workflow
const calc = await client.query(
  `SELECT id, name FROM workflow_entity WHERE name ILIKE '%calcular%metric%' OR name ILIKE '%ai%metric%' OR name ILIKE '%FINALIZAR%RUN%'`,
);
out.workflows.calcCandidates = calc.rows;
console.log('calc candidates', calc.rows);

// Production baseline
const ctx = await client.query(
  `SELECT id, version_label, mode, status, content_hash, published_at
   FROM ai_context_config_versions ORDER BY version_number`,
);
const ret = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions
   WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
const secrets = await client.query(
  `SELECT key, value FROM app_secrets
   WHERE key ILIKE '%context%' OR key ILIKE '%retrieval%'
   ORDER BY key`,
);
out.production = { context: ctx.rows, retrieval: ret.rows, secrets: secrets.rows };
console.log('PUBLISHED context', ctx.rows.filter((r) => r.status === 'PUBLISHED'));
console.log('secrets', secrets.rows);

writeFileSync(new URL('./_c212-inspect.json', import.meta.url), JSON.stringify(out, null, 2));
await client.end();
console.log('done');
