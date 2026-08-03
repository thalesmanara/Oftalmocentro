#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const ID = 'e4c0829578124470';
const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [ID],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;

for (const n of nodes) {
  if (n.type === 'n8n-nodes-base.postgres') {
    n.credentials = { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } };
    n.parameters.query = `
SELECT
  d.id AS def_id, d.code, d.purpose, d.description, d.active,
  d.created_at AS def_created_at, d.updated_at AS def_updated_at,
  v.id AS version_id, v.version_number, v.version_label, v.status, v.mode, v.environment,
  v.model_name, v.configuration, v.content_hash, v.validation_run_id, v.validation_score, v.notes,
  v.created_at AS version_created_at, v.published_at, v.published_by
FROM ai_context_configs d
JOIN ai_context_config_versions v ON v.context_config_id = d.id
WHERE d.code = 'AI_QUERY_CONTEXT' AND d.active = true
  AND (
    NULLIF(TRIM('{{ $json.query.id || $json.query.definitionId || "" }}'), '') IS NULL
    OR d.id::text = TRIM('{{ $json.query.id || $json.query.definitionId || "" }}')
  )
  AND (
    NULLIF(TRIM('{{ $json.query.versionId || "" }}'), '') IS NULL
    OR v.id::text = TRIM('{{ $json.query.versionId || "" }}')
  )
ORDER BY v.version_number DESC`;
    n.alwaysOutputData = true;
  }
  if (n.parameters?.jsCode && /montar|NOT_FOUND|versions/i.test(n.parameters.jsCode)) {
    n.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r && r.def_id && r.version_id);
const norm=$('Normalizar request').first().json || {};
let userId=''; let sessionId='';
try{ const auth=$('Validar auth').first().json||{}; userId=auth.userId||''; sessionId=auth.sessionId||''; }catch(_){}
if(!rows.length){
  return [{json:{ data:{ error:{ code:'NOT_FOUND', message:'Configuração de contexto não encontrada.' } }, statusCode:404, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId }}];
}
const d=rows[0];
const definition={
  id:d.def_id, code:d.code, purpose:d.purpose, description:d.description, active:!!d.active,
  createdAt:d.def_created_at, updatedAt:d.def_updated_at
};
const versions=rows.map(r=>({
  id:r.version_id, contextConfigId:d.def_id, versionNumber:Number(r.version_number), versionLabel:r.version_label,
  status:r.status, mode:r.mode, environment:r.environment, modelName:r.model_name,
  configuration: typeof r.configuration==='string' ? JSON.parse(r.configuration) : (r.configuration||{}),
  contentHash:r.content_hash, validationRunId:r.validation_run_id, validationScore:r.validation_score,
  notes:r.notes, createdAt:r.version_created_at, publishedAt:r.published_at
}));
const qVersion=String(norm.query?.versionId||'').trim();
const activeVersion=versions.find(v=>v.status==='PUBLISHED')||null;
const version=qVersion ? (versions.find(v=>v.id===qVersion)||null) : activeVersion;
return [{json:{ data:{ definition, versions, activeVersion, version }, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId }}];`;
  }
}

await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(nodes),
  ID,
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), ID, rows[0].activeVersionId],
  );
}
console.log('detail fixed');
await client.end();
