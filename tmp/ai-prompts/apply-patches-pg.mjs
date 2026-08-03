/**
 * Apply HEALTH / GET Health / BACKUP patches by updating workflow_entity nodes JSON,
 * then leave activeVersionId unchanged so MCP publish syncs history.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const dir = dirname(fileURLToPath(import.meta.url));
const CONN =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const probeSql = readFileSync(join(dir, '_patched-Probe_database.sql'), 'utf8');
const prepareJs = readFileSync(join(dir, '_patched-Prepare_checks.js'), 'utf8');
const aggregateJs = readFileSync(join(dir, '_patched-Aggregate_health.js'), 'utf8');

const client = new pg.Client({ connectionString: CONN });
await client.connect();

async function patchWorkflow(id, mutator) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id = $1`, [id]);
  if (!rows[0]) throw new Error('missing ' + id);
  const nodes = rows[0].nodes;
  const changed = mutator(nodes);
  if (!changed) {
    console.log('NOOP', rows[0].name);
    return { id, name: rows[0].name, changed: false };
  }
  await client.query(`UPDATE workflow_entity SET nodes = $1::json, "updatedAt" = NOW() WHERE id = $2`, [
    JSON.stringify(nodes),
    id,
  ]);
  console.log('PATCHED', rows[0].name, id);
  return { id, name: rows[0].name, changed: true };
}

const results = [];

results.push(
  await patchWorkflow('qAyYc9DrHIqe4L9i', (nodes) => {
    let changed = false;
    for (const n of nodes) {
      if (n.name === 'Probe database' && n.parameters?.query !== probeSql) {
        n.parameters.query = probeSql;
        changed = true;
      }
      if (n.name === 'Prepare checks' && n.parameters?.jsCode !== prepareJs) {
        n.parameters.jsCode = prepareJs;
        changed = true;
      }
      if (n.name === 'Aggregate health' && n.parameters?.jsCode !== aggregateJs) {
        n.parameters.jsCode = aggregateJs;
        changed = true;
      }
    }
    return changed;
  })
);

results.push(
  await patchWorkflow('2UPHcxASp2PboC9M', (nodes) => {
    const n = nodes.find((x) => x.name === 'Montar resposta admin');
    if (!n) return false;
    let code = n.parameters.jsCode || '';
    if (code.includes("'aiPrompts'") || code.includes('"aiPrompts"')) {
      // already has key in allowed list maybe
    }
    if (!code.includes("allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','configuration','sessions','audit','documents','backup','aiEval','aiPrompts']") &&
        !code.includes("allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','configuration','sessions','audit','documents','backup','aiEval']")) {
      return false;
    }
    if (!code.includes("'aiPrompts'")) {
      code = code.replace(
        "allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','configuration','sessions','audit','documents','backup','aiEval']",
        "allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','configuration','sessions','audit','documents','backup','aiEval','aiPrompts']"
      );
    }
    if (!code.includes("if (key === 'aiPrompts')")) {
      code = code.replace(
        `  if (key === 'aiEval') {
    out.casesCount = Number(c.casesCount || 0) || 0;
    if (c.lastScore != null) out.lastScore = Number(c.lastScore);
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
    if (c.lastRunStatus) out.lastRunStatus = c.lastRunStatus;
    if (c.avgDurationMs != null) out.avgDurationMs = Number(c.avgDurationMs);
  }
  components[key] = out;`,
        `  if (key === 'aiEval') {
    out.casesCount = Number(c.casesCount || 0) || 0;
    if (c.lastScore != null) out.lastScore = Number(c.lastScore);
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
    if (c.lastRunStatus) out.lastRunStatus = c.lastRunStatus;
    if (c.avgDurationMs != null) out.avgDurationMs = Number(c.avgDurationMs);
  }
  if (key === 'aiPrompts') {
    if (c.versionNumber != null) out.versionNumber = Number(c.versionNumber);
    if (c.modelName) out.modelName = c.modelName;
    if (c.publishedAt) out.publishedAt = c.publishedAt;
    if (c.validationScore != null) out.validationScore = Number(c.validationScore);
    out.draftCount = Number(c.draftCount || 0) || 0;
    out.publishedCount = Number(c.publishedCount || 0) || 0;
    out.missingPublished = !!c.missingPublished;
    out.multiplePublished = !!c.multiplePublished;
    // UI aliases (no content)
    if (c.versionNumber != null) out.activeVersion = String(c.versionNumber);
    if (c.modelName) out.model = c.modelName;
    out.draftsCount = Number(c.draftCount || 0) || 0;
  }
  components[key] = out;`
      );
    }
    if (code === n.parameters.jsCode) return false;
    n.parameters.jsCode = code;
    return true;
  })
);

results.push(
  await patchWorkflow('A16PhhWFr0Za9X3B', (nodes) => {
    const n = nodes.find((x) => x.name === 'Exportar tabelas app');
    if (!n) return false;
    let q = n.parameters.query || '';
    if (q.includes('ai_prompt_definitions')) return false;
    q = q.replace(
      "    'ai_test_metrics', (SELECT COALESCE(json_agg(row_to_json(tm)), '[]'::json) FROM (SELECT * FROM ai_test_metrics ORDER BY created_at DESC LIMIT 100) tm),\n    'app_secrets_keys', (SELECT COALESCE(json_agg(key), '[]'::json) FROM app_secrets)",
      "    'ai_test_metrics', (SELECT COALESCE(json_agg(row_to_json(tm)), '[]'::json) FROM (SELECT * FROM ai_test_metrics ORDER BY created_at DESC LIMIT 100) tm),\n    'ai_prompt_definitions', (SELECT COALESCE(json_agg(row_to_json(apd)), '[]'::json) FROM ai_prompt_definitions apd),\n    'ai_prompt_versions', (SELECT COALESCE(json_agg(row_to_json(apv)), '[]'::json) FROM ai_prompt_versions apv),\n    'app_secrets_keys', (SELECT COALESCE(json_agg(key), '[]'::json) FROM app_secrets)"
    );
    q = q.replace(
      "    'ai_test_metrics', (SELECT COUNT(*) FROM ai_test_metrics),\n    'app_secrets_keys', (SELECT COUNT(*) FROM app_secrets)",
      "    'ai_test_metrics', (SELECT COUNT(*) FROM ai_test_metrics),\n    'ai_prompt_definitions', (SELECT COUNT(*) FROM ai_prompt_definitions),\n    'ai_prompt_versions', (SELECT COUNT(*) FROM ai_prompt_versions),\n    'app_secrets_keys', (SELECT COUNT(*) FROM app_secrets)"
    );
    if (!q.includes('ai_prompt_definitions')) {
      console.error('BACKUP patch failed to match query pattern');
      return false;
    }
    n.parameters.query = q;
    return true;
  })
);

await client.end();
writeFileSync(join(dir, 'patch-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
