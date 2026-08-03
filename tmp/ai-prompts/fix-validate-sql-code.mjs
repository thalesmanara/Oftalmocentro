/**
 * Replace broken Code-node jsCode in create/update/validate with correctly escaped versions.
 */
import pg from 'pg';
import crypto from 'crypto';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const CONN =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const validateMontarSql = `const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const versionId = String(body.versionId || '').trim();
const validationRunId = String(body.validationRunId || '').trim();
const sql = [
  'SELECT',
  '  v.id AS "id", v.prompt_definition_id AS "promptDefinitionId", v.version_number AS "versionNumber",',
  '  v.status AS "status", v.environment AS "environment", v.content AS "content", v.model_name AS "modelName",',
  '  v.temperature AS "temperature", v.max_tokens AS "maxTokens", v.top_p AS "topP", v.parameters AS "parameters",',
  '  v.content_hash AS "contentHash", d.code AS "promptCode", d.purpose AS "purpose"',
  'FROM ai_prompt_versions v',
  'JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id',
  "WHERE v.id = NULLIF('" + esc(versionId) + "','')::uuid;"
].join('\\n');
return [{ json: { sql, versionId: versionId || null, validationRunId: validationRunId || null } }];`;

const validateFinalizar = `const val = $input.first().json || {};
const ctx = $('Avaliar contexto').first().json || {};
const marked = $('Marcar VALIDATING').first().json || {};
const ok = !!val.ok;
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const nextStatus = ok ? 'DRAFT' : 'REJECTED';
const sql = "UPDATE ai_prompt_versions SET status = '" + nextStatus + "' WHERE id = '" + esc(ctx.id) + "'::uuid RETURNING id AS \\"id\\", status AS \\"status\\", version_number AS \\"versionNumber\\", model_name AS \\"modelName\\", content_hash AS \\"contentHash\\", validation_run_id AS \\"validationRunId\\";";
return [{ json: {
  ok,
  errors: val.errors || [],
  warnings: val.warnings || [],
  sql,
  versionId: ctx.id,
  promptDefinitionId: ctx.promptDefinitionId,
  promptCode: ctx.promptCode,
  versionNumber: ctx.versionNumber,
  modelName: ctx.modelName,
  contentHash: ctx.contentHash,
  validationRunId: marked.validationRunId || ctx.validationRunId || null,
  nextStatus,
} }];`;

const createMontarContexto = `const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const promptDefinitionId = String(body.promptDefinitionId || '').trim();
const code = String(body.code || '').trim();
const basedOnVersionId = String(body.basedOnVersionId || '').trim();
const sql = [
  'WITH def AS (',
  '  SELECT d.id, d.code, d.purpose FROM ai_prompt_definitions d',
  '  WHERE (',
  "    ('" + esc(promptDefinitionId) + "' <> '' AND d.id = '" + esc(promptDefinitionId) + "'::uuid)",
  "    OR ('" + esc(promptDefinitionId) + "' = '' AND '" + esc(code) + "' <> '' AND d.code = '" + esc(code) + "')",
  '  )',
  '  LIMIT 1',
  '),',
  'based AS (',
  "  SELECT v.* FROM ai_prompt_versions v WHERE v.id = NULLIF('" + esc(basedOnVersionId) + "','')::uuid AND v.prompt_definition_id = (SELECT id FROM def)",
  '),',
  'maxv AS (',
  '  SELECT COALESCE(MAX(version_number),0) AS max_version FROM ai_prompt_versions WHERE prompt_definition_id = (SELECT id FROM def)',
  ')',
  'SELECT',
  '  (SELECT id FROM def) AS "promptDefinitionId",',
  '  (SELECT code FROM def) AS "promptCode",',
  '  (SELECT purpose FROM def) AS "purpose",',
  '  (SELECT max_version FROM maxv) AS "maxVersion",',
  '  b.content AS "basedContent", b.model_name AS "basedModelName", b.temperature AS "basedTemperature",',
  '  b.max_tokens AS "basedMaxTokens", b.top_p AS "basedTopP", b.parameters AS "basedParameters", b.environment AS "basedEnvironment"',
  'FROM (SELECT 1) x',
  'LEFT JOIN based b ON true;'
].join('\\n');
return [{ json: { sql, basedOnVersionId: basedOnVersionId || null } }];`;

const createMontarCriacao = `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
function j(v) { return esc(JSON.stringify(v ?? {})); }
const temperatureSql = ctx.temperature != null ? String(Number(ctx.temperature)) : 'NULL';
const maxTokensSql = ctx.maxTokens != null ? String(Number(ctx.maxTokens)) : 'NULL';
const topPSql = ctx.topP != null ? String(Number(ctx.topP)) : 'NULL';
const createdBySql = ctx.userId ? "'" + esc(ctx.userId) + "'::uuid" : 'NULL';
const basedOnSql = ctx.basedOnVersionId ? "'" + esc(ctx.basedOnVersionId) + "'::uuid" : 'NULL';
const changeSummarySql = ctx.changeSummary ? "'" + esc(ctx.changeSummary) + "'" : 'NULL';
const metadata = { createdVia: 'admin_api' };
const sql = [
  'WITH inserted AS (',
  '  INSERT INTO ai_prompt_versions (',
  '    prompt_definition_id, version_number, status, environment, content, model_name, temperature, max_tokens, top_p, parameters, change_summary, created_by, based_on_version_id, content_hash, metadata',
  '  ) VALUES (',
  "    '" + esc(ctx.promptDefinitionId) + "'::uuid, " + ctx.newVersionNumber + ", 'DRAFT', '" + esc(ctx.environment) + "',",
  "    '" + esc(ctx.content) + "', '" + esc(ctx.modelName) + "', " + temperatureSql + ", " + maxTokensSql + ", " + topPSql + ",",
  "    '" + j(ctx.parameters) + "'::jsonb, " + changeSummarySql + ", " + createdBySql + ", " + basedOnSql + ",",
  "    '" + esc(ctx.contentHash) + "', '" + j(metadata) + "'::jsonb",
  '  )',
  '  RETURNING *',
  ')',
  'SELECT',
  '  i.id AS "id", i.prompt_definition_id AS "promptDefinitionId", i.version_number AS "versionNumber",',
  '  i.status AS "status", i.environment AS "environment", i.content AS "content", i.model_name AS "modelName",',
  '  i.temperature AS "temperature", i.max_tokens AS "maxTokens", i.top_p AS "topP", i.parameters AS "parameters",',
  '  i.content_hash AS "contentHash", i.change_summary AS "changeSummary", i.created_by AS "createdBy",',
  '  i.based_on_version_id AS "basedOnVersionId", i.created_at AS "createdAt", i.metadata AS "metadata",',
  '  d.id AS "defId", d.code AS "defCode", d.name AS "defName", d.description AS "defDescription",',
  '  d.purpose AS "defPurpose", d.active AS "defActive", d.created_at AS "defCreatedAt", d.updated_at AS "defUpdatedAt"',
  'FROM inserted i',
  'JOIN ai_prompt_definitions d ON d.id = i.prompt_definition_id;'
].join('\\n');
return [{ json: { ...ctx, sql } }];`;

const updateMontarContexto = `const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const versionId = String(body.versionId || '').trim();
const sql = [
  'SELECT',
  '  v.id AS "id", v.prompt_definition_id AS "promptDefinitionId", v.version_number AS "versionNumber",',
  '  v.status AS "status", v.environment AS "environment", v.content AS "content", v.model_name AS "modelName",',
  '  v.temperature AS "temperature", v.max_tokens AS "maxTokens", v.top_p AS "topP", v.parameters AS "parameters",',
  '  v.change_summary AS "changeSummary", v.content_hash AS "contentHash", v.created_by AS "createdBy",',
  '  v.based_on_version_id AS "basedOnVersionId", v.created_at AS "createdAt", v.metadata AS "metadata",',
  '  d.code AS "defCode", d.purpose AS "defPurpose"',
  'FROM ai_prompt_versions v',
  'JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id',
  "WHERE v.id = NULLIF('" + esc(versionId) + "','')::uuid;"
].join('\\n');
return [{ json: { sql, versionId: versionId || null } }];`;

const updateMontarUpdate = `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
function j(v) { return esc(JSON.stringify(v ?? {})); }
const temperatureSql = ctx.temperature != null ? String(Number(ctx.temperature)) : 'NULL';
const maxTokensSql = ctx.maxTokens != null ? String(Number(ctx.maxTokens)) : 'NULL';
const topPSql = ctx.topP != null ? String(Number(ctx.topP)) : 'NULL';
const changeSummarySql = ctx.changeSummary ? "'" + esc(ctx.changeSummary) + "'" : 'NULL';
const sql = [
  'UPDATE ai_prompt_versions SET',
  "  content = '" + esc(ctx.content) + "',",
  "  model_name = '" + esc(ctx.modelName) + "',",
  '  temperature = ' + temperatureSql + ',',
  '  max_tokens = ' + maxTokensSql + ',',
  '  top_p = ' + topPSql + ',',
  "  parameters = '" + j(ctx.parameters) + "'::jsonb,",
  '  change_summary = ' + changeSummarySql + ',',
  "  content_hash = '" + esc(ctx.contentHash) + "',",
  "  status = CASE WHEN status = 'VALIDATING' THEN 'DRAFT' ELSE status END",
  "WHERE id = '" + esc(ctx.id) + "'::uuid AND status IN ('DRAFT','VALIDATING','REJECTED')",
  'RETURNING',
  '  id AS "id", prompt_definition_id AS "promptDefinitionId", version_number AS "versionNumber",',
  '  status AS "status", environment AS "environment", content AS "content", model_name AS "modelName",',
  '  temperature AS "temperature", max_tokens AS "maxTokens", top_p AS "topP", parameters AS "parameters",',
  '  content_hash AS "contentHash", change_summary AS "changeSummary", created_by AS "createdBy",',
  '  based_on_version_id AS "basedOnVersionId", created_at AS "createdAt", metadata AS "metadata";'
].join('\\n');
return [{ json: { ...ctx, sql } }];`;

const patches = {
  '1dNNsNKevnH6RRiR': {
    'Montar SQL de contexto': validateMontarSql,
    'Finalizar status': validateFinalizar,
  },
  q9U9E1gz8LbjrbBE: {
    'Montar SQL de contexto': createMontarContexto,
    'Montar SQL de criação': createMontarCriacao,
  },
  JZxiFaHPoH8Sn2M0: {
    'Montar SQL de contexto': updateMontarContexto,
    'Montar SQL de atualização': updateMontarUpdate,
  },
};

const client = new pg.Client({ connectionString: CONN });
await client.connect();
const out = [];

for (const [workflowId, map] of Object.entries(patches)) {
  const { rows } = await client.query(`SELECT name, nodes, connections, description FROM workflow_entity WHERE id=$1`, [
    workflowId,
  ]);
  const nodes = rows[0].nodes;
  let changed = 0;
  for (const n of nodes) {
    if (map[n.name] != null) {
      n.parameters.jsCode = map[n.name];
      changed++;
    }
  }
  const versionId = crypto.randomUUID();
  // Insert history first (FK), then point entity activeVersionId at it.
  // versionId is char(36); activeVersionId is varchar(36) — separate typed params.
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"nodeGroups","createdAt","updatedAt")
     VALUES ($1::varchar(36),$2::varchar(36),'sql-code-fix',$3::json,$4::json,$5,$6,false,'[]'::json,NOW(),NOW())`,
    [versionId, workflowId, JSON.stringify(nodes), JSON.stringify(rows[0].connections), rows[0].name, rows[0].description]
  );
  await client.query(
    `UPDATE workflow_entity
     SET nodes=$1::json,
         "versionId"=$2::char(36),
         "activeVersionId"=$3::varchar(36),
         "updatedAt"=NOW()
     WHERE id=$4::varchar(36)`,
    [JSON.stringify(nodes), versionId, versionId, workflowId]
  );
  out.push({ workflowId, name: rows[0].name, changed, versionId });
  console.log('OK', rows[0].name, versionId);
}

await client.end();
writeFileSync(join(dir, 'fix-sql-code-results.json'), JSON.stringify(out, null, 2));
