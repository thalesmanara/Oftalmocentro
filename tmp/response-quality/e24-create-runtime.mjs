#!/usr/bin/env node
/**
 * Etapa 24 — create IA - VALIDAR RESPOSTA + wire after OpenAI in Consulta IA.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Bundle helpers source for n8n Code node (deterministic, no LLM)
const helpersSrc = readFileSync(new URL('./quality-helpers.mjs', import.meta.url), 'utf8')
  .replace(/^export /gm, '')
  .replace(/import[^\n]+\n/g, '');

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const QUALITY_ID = 'c24ResponseQuality01';
const CONSULTA = '8EXk5RkFW5cxnenL';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true, description = 'Etapa 24' }) {
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  const exists = await client.query(`SELECT id FROM workflow_entity WHERE id=$1`, [id]);
  await client.query('BEGIN');
  if (!exists.rowCount) {
    await client.query(
      `INSERT INTO workflow_entity (id,name,active,nodes,connections,"versionId","activeVersionId","createdAt","updatedAt",settings,"isArchived")
       VALUES ($1,$2,false,$3::json,$4::json,$5::varchar,NULL,NOW(),NOW(),'{}'::json,false)`,
      [id, name, nodesJson, connJson, versionId],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
         VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
  }
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name, description],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  console.log('WF', name, id, versionId);
  return versionId;
}

const prepareCode = `const t=$input.first().json||{};
const parse=(s,fb)=>{try{return typeof s==='string'&&s?JSON.parse(s):(s??fb);}catch(_){return fb;}};
return [{json:{
  answer:String(t.answer||''),
  question:String(t.question||''),
  sources:parse(t.sourcesJson,[]),
  evidenceMeta:parse(t.evidenceMetaJson,{}),
  contextMeta:parse(t.contextMetaJson,{}),
  retrievalMeta:parse(t.retrievalMetaJson,{}),
  responseQualityConfigVersionId:t.responseQualityConfigVersionId||null,
  requestId:String(t.requestId||''),
}}];`;

const validateCode = `${helpersSrc}

const prep=$('Preparar entrada').first().json||{};
const cfgRow=$('Load config').first().json||{};
let configuration={};
try{configuration=typeof cfgRow.configuration==='string'?JSON.parse(cfgRow.configuration):(cfgRow.configuration||{});}catch(_){configuration={};}
const mode=String(configuration.mode||cfgRow.mode||'VALIDATE').toUpperCase();
const versionLabel=cfgRow.version_label||'response-quality-v1';
const versionId=cfgRow.id||null;

const input={
  answer:prep.answer,
  question:prep.question,
  sources:prep.sources,
  evidenceMeta:prep.evidenceMeta,
  contextMeta:prep.contextMeta,
  retrievalMeta:prep.retrievalMeta,
  configVersion:versionLabel,
  configVersionId:versionId,
};

let result;
if(mode==='DISABLED'||mode==='PASSTHROUGH'){
  result=evaluateDisabledOrPassthrough(input, mode);
} else {
  configuration.mode=mode;
  if(mode==='VALIDATE_STRICT'){
    configuration.requireSources=configuration.requireSources!==false;
    configuration.minQualityScoreWarn=configuration.minQualityScoreWarn??65;
  }
  result=evaluateResponseQuality(input, configuration);
}

return [{json:{
  answer:result.answer,
  responseMeta:result.responseMeta,
  auditAction:'AI_RESPONSE_VALIDATION_STARTED',
  auditActionFinal:result.auditAction,
  qualityScore:result.qualityScore,
  qualityGrade:result.qualityGrade,
  consistencyStatus:result.consistencyStatus,
  requestId:prep.requestId,
  mode,
  configVersion:versionLabel,
  configVersionId:versionId,
}}];`;

const nodes = [
  {
    id: randomUUID(),
    name: 'Trigger',
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.1,
    position: [0, 0],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          'answer',
          'question',
          'sourcesJson',
          'evidenceMetaJson',
          'contextMetaJson',
          'retrievalMetaJson',
          'responseQualityConfigVersionId',
          'requestId',
        ].map((name) => ({ name, type: 'string' })),
      },
    },
  },
  {
    id: randomUUID(),
    name: 'Preparar entrada',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [220, 0],
    parameters: { jsCode: prepareCode },
  },
  {
    id: randomUUID(),
    name: 'Load config',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [440, 0],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const id = String($json.responseQualityConfigVersionId || '').trim();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    return "SELECT id, version_label, mode, status, configuration FROM ai_response_quality_config_versions WHERE id='" + id + "' LIMIT 1";
  }
  return "SELECT id, version_label, mode, status, configuration FROM ai_response_quality_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Validar resposta',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [660, 0],
    parameters: { jsCode: validateCode },
  },
];

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Load config', type: 'main', index: 0 }]] },
  'Load config': { main: [[{ node: 'Validar resposta', type: 'main', index: 0 }]] },
};

const runtimeVid = await upsertWorkflow({
  id: QUALITY_ID,
  name: 'IA - VALIDAR RESPOSTA',
  nodes,
  connections,
  active: true,
  description: 'Etapa 24 Response Quality Layer',
});

// ---- Wire Consulta ----
{
  const { rows } = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id=$1`, [CONSULTA]);
  let nodesC = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connC =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  const skip = new Set(['IA - VALIDAR RESPOSTA', 'Aplicar validação resposta']);
  nodesC = nodesC.filter((n) => !skip.has(n.name));
  for (const k of Object.keys(connC)) {
    if (!connC[k]?.main) continue;
    connC[k].main = connC[k].main.map((branch) => (branch || []).filter((c) => !skip.has(c.node)));
  }
  delete connC['IA - VALIDAR RESPOSTA'];
  delete connC['Aplicar validação resposta'];

  nodesC.push({
    id: randomUUID(),
    name: 'IA - VALIDAR RESPOSTA',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [1680, 520],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: QUALITY_ID },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          answer: `={{ (() => {
  const o=$('Message a model').first().json||{};
  return String(o.output?.[0]?.content?.[0]?.text ?? o.text ?? o.message ?? '');
})() }}`,
          question: "={{ $('Aplicar cache lookup').first().json.question || '' }}",
          sourcesJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.sources || []) }}",
          evidenceMetaJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.evidenceMeta || {}) }}",
          contextMetaJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.contextMeta || {}) }}",
          retrievalMetaJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.retrievalMeta || {}) }}",
          responseQualityConfigVersionId: `={{ (() => { const b=$('Normalizar request').first().json.body||{}; return String(b.responseQualityConfigVersionId||''); })() }}`,
          requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
        },
      },
      options: {},
    },
  });

  nodesC.push({
    id: randomUUID(),
    name: 'Aplicar validação resposta',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1900, 520],
    parameters: {
      jsCode: `const openai=$('Message a model').first().json||{};
const q=$input.first().json||{};
const fallbackAnswer=openai.output?.[0]?.content?.[0]?.text ?? '';
const answer=String(q.answer!=null&&q.answer!==''?q.answer:fallbackAnswer);
return [{json:{
  answer,
  responseMeta:q.responseMeta||null,
  auditAction:q.auditActionFinal||q.auditAction||'AI_RESPONSE_VALIDATION_COMPLETED',
  qualityScore:q.qualityScore??null,
  qualityGrade:q.qualityGrade??null,
  consistencyStatus:q.consistencyStatus||null,
}}];`,
    },
  });

  // Message a model → VALIDAR → Aplicar → SALVAR CACHE
  connC['Message a model'] = {
    main: [[{ node: 'IA - VALIDAR RESPOSTA', type: 'main', index: 0 }]],
  };
  connC['IA - VALIDAR RESPOSTA'] = {
    main: [[{ node: 'Aplicar validação resposta', type: 'main', index: 0 }]],
  };
  connC['Aplicar validação resposta'] = {
    main: [[{ node: 'IA - SALVAR CACHE', type: 'main', index: 0 }]],
  };

  // Patch Aplicar cache save to use validated answer + responseMeta
  const aplicarSave = nodesC.find((n) => n.name === 'Aplicar cache save');
  if (aplicarSave?.parameters?.jsCode) {
    aplicarSave.parameters.jsCode = `const openai=$('Message a model').first().json||{};
const lookup=$('Aplicar cache lookup').first().json||{};
const save=$input.first().json||{};
const validated=(()=>{try{return $('Aplicar validação resposta').first().json||{};}catch(_){return {};}})();
const answer=String(validated.answer!=null&&validated.answer!==''?validated.answer:(openai.output?.[0]?.content?.[0]?.text ?? ''));
const prompt=$('Aplicar prompt carregado').first().json||{};
const sources=(lookup.sources||[]).map(s=>({...s, expirationDate:s.expirationDate??s.vigencyDate??null}));
const requestId=$('Normalizar request').first().json.requestId;
const cacheMeta={...(lookup.cacheMeta||{}), ...(save.cacheMeta||{}), answerFromCache:false};
const evidenceMeta=lookup.evidenceMeta||null;
const responseMeta=validated.responseMeta||null;
return [{json:{data:{question:lookup.question,answer,sources,classification:lookup.classification,retrievalMeta:lookup.retrievalMeta||null,contextMeta:lookup.contextMeta||null,cacheMeta,evidenceMeta,responseMeta,promptVersion:prompt.versionNumber||prompt.promptVersion||null,modelName:prompt.modelName||null},requestId,auditAction:validated.auditAction||null}}];`;
  }

  // Patch Montar resposta cache (HIT path) to include responseMeta placeholder + evidenceMeta
  const montarCache = nodesC.find((n) => n.name === 'Montar resposta cache');
  if (montarCache?.parameters?.jsCode) {
    montarCache.parameters.jsCode = `const ctx=$('Aplicar cache lookup').first().json||{};
const prompt=$('Aplicar prompt carregado').first().json||{};
const answer=String(ctx.cachedAnswer||'');
const sources=(ctx.cachedSources||ctx.sources||[]).map(s=>({...s, expirationDate:s.expirationDate??s.vigencyDate??null}));
const requestId=$('Normalizar request').first().json.requestId;
const responseMeta={skipped:true,mode:'CACHE_HIT',schemaVersion:'response-quality-schema-v1',note:'Cache HIT — validação completa ocorre no path OpenAI; SHADOW não serve resposta'};
return [{json:{data:{question:ctx.question,answer,sources,classification:ctx.classification,retrievalMeta:ctx.retrievalMeta||null,contextMeta:ctx.contextMeta||null,cacheMeta:ctx.cacheMeta||null,evidenceMeta:ctx.evidenceMeta||null,responseMeta,promptVersion:prompt.versionNumber||prompt.promptVersion||null,modelName:prompt.modelName||null},requestId}}];`;
  }

  const consultaVid = await upsertWorkflow({
    id: CONSULTA,
    name: rows[0].name,
    nodes: nodesC,
    connections: connC,
    active: true,
    description: 'Etapa 24 wire Response Quality Layer',
  });

  writeFileSync(
    new URL('./_e24-runtime.json', import.meta.url),
    JSON.stringify({ QUALITY_ID, runtimeVid, consultaVid }, null, 2),
  );
}

await client.end();
console.log('done');
