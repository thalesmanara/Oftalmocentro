#!/usr/bin/env node
/**
 * Clone retrieval admin webhooks → ai-context endpoints (list/detail/create/update/validate/publish/rollback)
 */
import crypto from 'crypto';
import pg from 'pg';
import { writeFileSync } from 'fs';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const PROJECT = 'WbvMM1wAedTR9qrk';
const VALIDATE_ID = '0289408b8d774379';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const uuid = () => crypto.randomUUID();
const wfId = () => uuid().replace(/-/g, '').slice(0, 16);

async function load(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId", settings, meta FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes),
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : structuredClone(rows[0].connections),
  };
}

async function saveNew(name, nodes, connections, description) {
  const existing = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name=$1`, [name]);
  let id = existing.rows[0]?.id;
  const versionId = uuid();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  if (!id) {
    id = wfId();
    await client.query(
      `INSERT INTO workflow_entity (
        id, name, active, nodes, connections, settings, "staticData", "pinData",
        "versionId", "triggerCount", meta, "parentFolderId", "createdAt", "updatedAt",
        "isArchived", "activeVersionId"
      ) VALUES ($1,$2,true,$3::json,$4::json,$5::json,NULL,NULL,$6,0,$7::json,NULL,NOW(),NOW(),false,NULL)`,
      [
        id,
        name,
        nodesJson,
        connJson,
        JSON.stringify({ executionOrder: 'v1', availableInMCP: true }),
        versionId,
        JSON.stringify({ builderVariant: 'etapa21-cwm-admin' }),
      ],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
         VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
      [versionId, id, nodesJson, connJson, name, description || ''],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar WHERE id=$2`,
      [versionId, id],
    );
  } else {
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`,
      [nodesJson, connJson, id],
    );
    if (existing.rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
        [nodesJson, connJson, id, existing.rows[0].activeVersionId],
      );
    }
  }
  return id;
}

function replaceAllInWorkflow(nodes, pairs) {
  const s = JSON.stringify(nodes);
  let out = s;
  for (const [a, b] of pairs) out = out.split(a).join(b);
  return JSON.parse(out);
}

function setWebhook(nodes, path, method) {
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.webhook') {
      n.webhookId = uuid();
      n.parameters = { ...(n.parameters || {}), path, httpMethod: method, responseMode: 'responseNode', options: {} };
    }
  }
}

// Source templates
const listSrc = await load('SxDfJMFCQbytHHL6');
const detailSrc = await load('EdG14rWgluDHiOtt');
const createSrc = await load('RjQDc5gcWFYyBQJO');
const updateSrc = await load('Ci5BcAlkZCxOxdyA');
const validateSrc = await load('DesGIYYOTdv0ws9J');
const publishSrc = await load('BAHKNoJM7VdYU8UE');
const rollbackSrc = await load('FdaMsXY4nXEO0xV8');

// ---- LIST ----
{
  let nodes = replaceAllInWorkflow(listSrc.nodes, [
    ['ai-retrieval', 'ai-context'],
    ['ai_retrieval_configs', 'ai_context_configs'],
    ['ai_retrieval_config_versions', 'ai_context_config_versions'],
    ['retrieval_config_id', 'context_config_id'],
    ['AI_QUERY_RETRIEVAL', 'AI_QUERY_CONTEXT'],
    ['activeMode', 'activeMode'],
  ]);
  setWebhook(nodes, 'system/ai-context', 'GET');
  // Replace list SQL node if present
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query) {
      n.parameters.query = `
SELECT
  d.id, d.code, d.purpose, d.description, d.active, d.created_at AS "createdAt", d.updated_at AS "updatedAt",
  (SELECT COUNT(*)::int FROM ai_context_config_versions v WHERE v.context_config_id=d.id) AS "versionCount",
  (SELECT COUNT(*)::int FROM ai_context_config_versions v WHERE v.context_config_id=d.id AND v.status='DRAFT') AS "draftCount",
  p.mode AS "activeMode",
  p.version_label AS "activeVersionLabel",
  p.id AS "publishedVersionId",
  p.version_number AS "publishedVersionNumber",
  p.published_at AS "publishedAt",
  p.validation_score AS "validationScore",
  p.content_hash AS "contentHash",
  p.configuration AS "publishedConfiguration"
FROM ai_context_configs d
LEFT JOIN LATERAL (
  SELECT * FROM ai_context_config_versions v
  WHERE v.context_config_id=d.id AND v.status='PUBLISHED'
  ORDER BY v.published_at DESC NULLS LAST LIMIT 1
) p ON true
WHERE d.active = true
ORDER BY d.code`;
      n.credentials = { postgres: PG };
    }
    if (n.parameters?.jsCode && n.name.toLowerCase().includes('montar')) {
      n.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r&&r.id);
const items=rows.map(r=>({
  id:r.id, code:r.code, purpose:r.purpose, description:r.description, active:!!r.active,
  createdAt:r.createdAt, updatedAt:r.updatedAt,
  versionCount:Number(r.versionCount||0), draftCount:Number(r.draftCount||0),
  activeMode:r.activeMode||null, activeVersionLabel:r.activeVersionLabel||null,
  publishedVersion: r.publishedVersionId ? {
    id:r.publishedVersionId, versionNumber:r.publishedVersionNumber, versionLabel:r.activeVersionLabel,
    mode:r.activeMode, configuration:r.publishedConfiguration, publishedAt:r.publishedAt,
    validationScore:r.validationScore, contentHash:r.contentHash
  } : null
}));
const norm=$('Normalizar request').first().json;
return [{json:{ data:{ items }, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path,
  userId:$('Validar auth').first().json.userId||'', sessionId:$('Validar auth').first().json.sessionId||'' }}];`;
    }
  }
  const id = await saveNew('SYSTEM - AI CONTEXT LIST', nodes, listSrc.connections, 'Lista configs de contexto');
  console.log('LIST', id);
}

// ---- DETAIL ----
{
  let nodes = replaceAllInWorkflow(detailSrc.nodes, [
    ['ai-retrieval', 'ai-context'],
    ['ai_retrieval_configs', 'ai_context_configs'],
    ['ai_retrieval_config_versions', 'ai_context_config_versions'],
    ['retrieval_config_id', 'context_config_id'],
  ]);
  setWebhook(nodes, 'system/ai-context/detail', 'GET');
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres' && n.parameters?.query) {
      n.credentials = { postgres: PG };
      n.parameters.query = `
WITH params AS (
  SELECT
    NULLIF(TRIM('{{ $json.query.id || $json.query.definitionId || "" }}'),'')::uuid AS def_id,
    NULLIF(TRIM('{{ $json.query.versionId || "" }}'),'')::uuid AS version_id
)
SELECT
  d.id AS def_id, d.code, d.purpose, d.description, d.active,
  d.created_at AS def_created_at, d.updated_at AS def_updated_at,
  v.id AS version_id, v.version_number, v.version_label, v.status, v.mode, v.environment,
  v.model_name, v.configuration, v.content_hash, v.validation_run_id, v.validation_score, v.notes,
  v.created_at AS version_created_at, v.published_at, v.published_by
FROM ai_context_configs d
JOIN ai_context_config_versions v ON v.context_config_id = d.id
CROSS JOIN params p
WHERE d.code='AI_QUERY_CONTEXT'
  AND (p.def_id IS NULL OR d.id=p.def_id)
  AND (p.version_id IS NULL OR v.id=p.version_id)
ORDER BY v.version_number DESC`;
    }
    if (n.parameters?.jsCode && /montar|Montar|format/i.test(n.name + (n.parameters.jsCode.slice(0, 40)))) {
      // leave generic; add a dedicated formatter node replacement for known names
    }
  }
  // Force a reliable Montar resposta
  const montar = nodes.find((n) => /montar/i.test(n.name) && n.type.includes('code'));
  if (montar) {
    montar.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r&& (r.def_id||r.version_id));
const norm=$('Normalizar request').first().json;
if(!rows.length){
  return [{json:{ data:{ error:{code:'NOT_FOUND',message:'Configuração não encontrada.'}}, statusCode:404, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId:'', sessionId:'' }}];
}
const d=rows[0];
const definition={
  id:d.def_id, code:d.code, purpose:d.purpose, description:d.description, active:!!d.active,
  createdAt:d.def_created_at, updatedAt:d.def_updated_at
};
const versions=rows.map(r=>({
  id:r.version_id, contextConfigId:d.def_id, versionNumber:r.version_number, versionLabel:r.version_label,
  status:r.status, mode:r.mode, environment:r.environment, modelName:r.model_name,
  configuration:r.configuration, contentHash:r.content_hash, validationRunId:r.validation_run_id,
  validationScore:r.validation_score, notes:r.notes, createdAt:r.version_created_at, publishedAt:r.published_at
}));
const qVersion=String(norm.query?.versionId||'').trim();
const activeVersion=versions.find(v=>v.status==='PUBLISHED')||null;
const version=qVersion?versions.find(v=>v.id===qVersion)||null:activeVersion;
return [{json:{ data:{ definition, versions, activeVersion, version }, statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path,
  userId:$('Validar auth').first().json.userId||'', sessionId:$('Validar auth').first().json.sessionId||'' }}];`;
  }
  const id = await saveNew('SYSTEM - AI CONTEXT DETAIL', nodes, detailSrc.connections, 'Detalhe configs de contexto');
  console.log('DETAIL', id);
}

// ---- CREATE DRAFT ----
{
  let nodes = replaceAllInWorkflow(createSrc.nodes, [
    ['ai-retrieval', 'ai-context'],
    ['ai_retrieval_configs', 'ai_context_configs'],
    ['ai_retrieval_config_versions', 'ai_context_config_versions'],
    ['retrieval_config_id', 'context_config_id'],
    ['AI_RETRIEVAL_CONFIG_DRAFT_CREATE', 'AI_CONTEXT_CONFIG_DRAFT_CREATE'],
    ['AI_RETRIEVAL_DRAFT_CREATE', 'AI_CONTEXT_CONFIG_DRAFT_CREATE'],
    ['NhWUkmzGhlttJC9S', VALIDATE_ID],
    ['IA - VALIDAR RETRIEVAL CONFIG', 'IA - VALIDAR CONTEXT CONFIG'],
  ]);
  setWebhook(nodes, 'system/ai-context/create', 'POST');
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG };
    if (n.parameters?.jsCode) {
      n.parameters.jsCode = n.parameters.jsCode
        .replaceAll('AI_QUERY_RETRIEVAL', 'AI_QUERY_CONTEXT')
        .replaceAll('retrieval_config_id', 'context_config_id')
        .replaceAll('ai_retrieval_config', 'ai_context_config');
    }
    if (n.parameters?.query) {
      n.parameters.query = n.parameters.query
        .replaceAll('ai_retrieval_configs', 'ai_context_configs')
        .replaceAll('ai_retrieval_config_versions', 'ai_context_config_versions')
        .replaceAll('retrieval_config_id', 'context_config_id')
        .replaceAll('AI_QUERY_RETRIEVAL', 'AI_QUERY_CONTEXT');
    }
    if (n.type.includes('executeWorkflow') && n.parameters?.workflowId) {
      const val = n.parameters.workflowId?.value || '';
      if (String(val).includes('NhWU') || n.parameters.workflowId?.cachedResultName?.includes('VALIDAR RETRIEVAL')) {
        n.parameters.workflowId = {
          __rl: true,
          mode: 'id',
          value: VALIDATE_ID,
          cachedResultName: 'IA - VALIDAR CONTEXT CONFIG',
        };
      }
    }
  }
  const id = await saveNew('SYSTEM - AI CONTEXT CREATE', nodes, createSrc.connections, 'Cria draft de contexto');
  console.log('CREATE', id);
}

// ---- UPDATE / VALIDATE / PUBLISH / ROLLBACK (string replace) ----
async function adapt(src, name, path, method, extraPairs = []) {
  let nodes = replaceAllInWorkflow(src.nodes, [
    ['ai-retrieval', 'ai-context'],
    ['ai_retrieval_configs', 'ai_context_configs'],
    ['ai_retrieval_config_versions', 'ai_context_config_versions'],
    ['retrieval_config_id', 'context_config_id'],
    ['AI_RETRIEVAL_CONFIG_DRAFT_UPDATE', 'AI_CONTEXT_CONFIG_DRAFT_UPDATE'],
    ['AI_RETRIEVAL_DRAFT_UPDATE', 'AI_CONTEXT_CONFIG_DRAFT_UPDATE'],
    ['AI_RETRIEVAL_CONFIG_VALIDATED', 'AI_CONTEXT_CONFIG_VALIDATED'],
    ['AI_RETRIEVAL_CONFIG_PUBLISHED', 'AI_CONTEXT_CONFIG_PUBLISHED'],
    ['AI_RETRIEVAL_CONFIG_PUBLISH_OVERRIDE', 'AI_CONTEXT_CONFIG_PUBLISHED'],
    ['AI_RETRIEVAL_CONFIG_ROLLBACK', 'AI_CONTEXT_CONFIG_ROLLBACK'],
    ['NhWUkmzGhlttJC9S', VALIDATE_ID],
    ['IA - VALIDAR RETRIEVAL CONFIG', 'IA - VALIDAR CONTEXT CONFIG'],
    ...extraPairs,
  ]);
  setWebhook(nodes, path, method);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') n.credentials = { postgres: PG };
    if (n.parameters?.jsCode) {
      n.parameters.jsCode = n.parameters.jsCode
        .replaceAll('AI_QUERY_RETRIEVAL', 'AI_QUERY_CONTEXT')
        .replaceAll('retrieval_config_id', 'context_config_id')
        .replaceAll('ai_retrieval_config', 'ai_context_config');
    }
    if (n.parameters?.query) {
      n.parameters.query = n.parameters.query
        .replaceAll('ai_retrieval_configs', 'ai_context_configs')
        .replaceAll('ai_retrieval_config_versions', 'ai_context_config_versions')
        .replaceAll('retrieval_config_id', 'context_config_id')
        .replaceAll('uq_ai_retrieval_one_published', 'uq_ai_context_one_published');
    }
    if (n.type.includes('executeWorkflow') && n.parameters?.workflowId) {
      const cached = n.parameters.workflowId?.cachedResultName || '';
      if (cached.includes('VALIDAR RETRIEVAL') || String(n.parameters.workflowId?.value || '').includes('NhWU')) {
        n.parameters.workflowId = {
          __rl: true,
          mode: 'id',
          value: VALIDATE_ID,
          cachedResultName: 'IA - VALIDAR CONTEXT CONFIG',
        };
      }
    }
  }
  const id = await saveNew(name, nodes, src.connections, name);
  console.log(name, id);
  return id;
}

const ids = {
  UPDATE: await adapt(updateSrc, 'SYSTEM - AI CONTEXT UPDATE', 'system/ai-context/update', 'PUT'),
  VALIDATE: await adapt(validateSrc, 'SYSTEM - AI CONTEXT VALIDATE', 'system/ai-context/validate', 'POST'),
  PUBLISH: await adapt(publishSrc, 'SYSTEM - AI CONTEXT PUBLISH', 'system/ai-context/publish', 'POST'),
  ROLLBACK: await adapt(rollbackSrc, 'SYSTEM - AI CONTEXT ROLLBACK', 'system/ai-context/rollback', 'POST'),
};

writeFileSync(new URL('./_cwm-admin-ids.json', import.meta.url), JSON.stringify(ids, null, 2));
await client.end();
