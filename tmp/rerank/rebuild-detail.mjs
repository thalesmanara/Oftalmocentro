#!/usr/bin/env node
/** Rebuild GET detail as a clean minimal clone of GET list wiring */
import pg from 'pg';
import crypto from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const list = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='SxDfJMFCQbytHHL6'`);
const nodes = JSON.parse(JSON.stringify(typeof list.rows[0].nodes === 'string' ? JSON.parse(list.rows[0].nodes) : list.rows[0].nodes));
const connections = JSON.parse(JSON.stringify(typeof list.rows[0].connections === 'string' ? JSON.parse(list.rows[0].connections) : list.rows[0].connections));

for (const n of nodes) {
  if (n.type === 'n8n-nodes-base.webhook') {
    n.parameters.path = 'system/ai-retrieval/detail';
    n.webhookId = crypto.randomUUID();
  }
  if (n.name === 'Listar retrieval configs') {
    n.name = 'Buscar retrieval detail';
    n.parameters.query = `SELECT
  c.id AS "definitionId", c.code, c.purpose, c.description, c.active,
  c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  v.id AS "versionId", v.version_number AS "versionNumber", v.version_label AS "versionLabel",
  v.status, v.mode, v.configuration, v.content_hash AS "contentHash",
  v.validation_run_id AS "validationRunId", v.validation_score AS "validationScore",
  v.notes, v.created_at AS "versionCreatedAt", v.published_at AS "publishedAt"
FROM ai_retrieval_configs c
LEFT JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.code = 'AI_QUERY_RETRIEVAL'
ORDER BY v.version_number DESC;`;
  }
  if (n.name === 'Coletar lista') {
    n.name = 'Coletar detalhe';
    n.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r&&r.definitionId);
const norm=$('Normalizar request').first().json;
const q=norm.query||{};
const versionIdFilter=String(q.versionId||'').trim();
if(!rows.length){
  return [{json:{data:{error:'RETRIEVAL_CONFIG_NOT_FOUND'}, statusCode:404, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path}}];
}
const def={id:rows[0].definitionId, code:rows[0].code, purpose:rows[0].purpose, description:rows[0].description||null, active:!!rows[0].active, createdAt:rows[0].createdAt, updatedAt:rows[0].updatedAt};
const versions=rows.filter(r=>r.versionId).map(r=>{
  let configuration=r.configuration;
  if(typeof configuration==='string'){try{configuration=JSON.parse(configuration);}catch(_){configuration={};}}
  return {id:r.versionId, retrievalConfigId:r.definitionId, versionNumber:Number(r.versionNumber||0), versionLabel:r.versionLabel, status:r.status, mode:r.mode, configuration, contentHash:r.contentHash, validationRunId:r.validationRunId||null, validationScore:r.validationScore!=null?Number(r.validationScore):null, notes:r.notes||null, createdAt:r.versionCreatedAt, publishedAt:r.publishedAt||null};
});
const activeVersion=versions.find(v=>v.status==='PUBLISHED')||null;
const version=versionIdFilter?versions.find(v=>v.id===versionIdFilter)||null:null;
let userId='', sessionId='';
try{const a=$('Validar auth').first().json; userId=a.userId||''; sessionId=a.sessionId||'';}catch(_){}
return [{json:{data:{definition:def, versions, activeVersion, version}, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId}}];`;
  }
}

// fix connections names
connections['Restaurar request'] = { main: [[{ node: 'Buscar retrieval detail', type: 'main', index: 0 }]] };
connections['Buscar retrieval detail'] = { main: [[{ node: 'Coletar detalhe', type: 'main', index: 0 }]] };
connections['Coletar detalhe'] = { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] };
delete connections['Listar retrieval configs'];
delete connections['Coletar lista'];
delete connections['Listar prompts'];

const { rows } = await client.query(`SELECT "activeVersionId" FROM workflow_entity WHERE id='EdG14rWgluDHiOtt'`);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id='EdG14rWgluDHiOtt'`,
  [JSON.stringify(nodes), JSON.stringify(connections)],
);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), 'EdG14rWgluDHiOtt', rows[0].activeVersionId],
  );
}
console.log('detail rebuilt', nodes.map((n) => n.name));
await client.end();
