#!/usr/bin/env node
/**
 * Etapa 25 — IA - APLICAR POLÍTICA DE RESPOSTA + wire after Quality, before Cache.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const helpersSrc = readFileSync(new URL('./quality-helpers.mjs', import.meta.url), 'utf8')
  .replace(/^export /gm, '')
  .replace(/import[^\n]+\n/g, '');

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const POLICY_ID = 'c25ResponsePolicy01';
const CONSULTA = '8EXk5RkFW5cxnenL';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true, description = 'Etapa 25' }) {
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
     VALUES ($1::varchar,$2,'etapa25',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
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
  question:String(t.question||''),
  answer:String(t.answer||''),
  sources:parse(t.sourcesJson,[]),
  classification:parse(t.classificationJson,{}),
  responseMeta:parse(t.responseMetaJson,{}),
  evidenceMeta:parse(t.evidenceMetaJson,{}),
  contextMeta:parse(t.contextMetaJson,{}),
  retrievalMeta:parse(t.retrievalMetaJson,{}),
  responseQualityConfigVersionId:t.responseQualityConfigVersionId||null,
  requestId:String(t.requestId||''),
}}];`;

const applyCode = `${helpersSrc}

const prep=$('Preparar entrada').first().json||{};
const cfgRow=$('Load config').first().json||{};
let configuration={};
try{configuration=typeof cfgRow.configuration==='string'?JSON.parse(cfgRow.configuration):(cfgRow.configuration||{});}catch(_){configuration={};}
const versionLabel=cfgRow.version_label||'response-quality-v1';
const versionId=cfgRow.id||null;
if(configuration.mode) configuration.mode=String(configuration.mode).toUpperCase();

const result=applyResponsePolicy({
  question:prep.question,
  answer:prep.answer,
  sources:prep.sources,
  classification:prep.classification,
  responseMeta:prep.responseMeta,
  evidenceMeta:prep.evidenceMeta,
  contextMeta:prep.contextMeta,
  retrievalMeta:prep.retrievalMeta,
  configVersion:versionLabel,
  configVersionId:versionId,
}, configuration);

return [{json:{
  answer:result.answer,
  sources:result.sources,
  policyMeta:{...(result.policyMeta||{}), configVersion:versionLabel, configVersionId:versionId},
  responseMeta:prep.responseMeta,
  auditAction:result.auditAction||'AI_RESPONSE_POLICY_APPLIED',
  requestId:prep.requestId,
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
          'question',
          'answer',
          'sourcesJson',
          'classificationJson',
          'responseMetaJson',
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
    name: 'Aplicar política',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [660, 0],
    parameters: { jsCode: applyCode },
  },
];

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Load config', type: 'main', index: 0 }]] },
  'Load config': { main: [[{ node: 'Aplicar política', type: 'main', index: 0 }]] },
};

const runtimeVid = await upsertWorkflow({
  id: POLICY_ID,
  name: 'IA - APLICAR POLÍTICA DE RESPOSTA',
  nodes,
  connections,
  active: true,
  description: 'Etapa 25 Response Policy',
});

// Wire Consulta
{
  const { rows } = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id=$1`, [CONSULTA]);
  let nodesC = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connC =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  const skip = new Set(['IA - APLICAR POLÍTICA DE RESPOSTA', 'Aplicar política resposta']);
  nodesC = nodesC.filter((n) => !skip.has(n.name));
  for (const k of Object.keys(connC)) {
    if (!connC[k]?.main) continue;
    connC[k].main = connC[k].main.map((branch) => (branch || []).filter((c) => !skip.has(c.node)));
  }
  delete connC['IA - APLICAR POLÍTICA DE RESPOSTA'];
  delete connC['Aplicar política resposta'];

  nodesC.push({
    id: randomUUID(),
    name: 'IA - APLICAR POLÍTICA DE RESPOSTA',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [2000, 520],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: POLICY_ID },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          question: "={{ $('Aplicar cache lookup').first().json.question || '' }}",
          answer: "={{ $('Aplicar validação resposta').first().json.answer || '' }}",
          sourcesJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.sources || []) }}",
          classificationJson:
            "={{ JSON.stringify($('Aplicar cache lookup').first().json.classification || {}) }}",
          responseMetaJson:
            "={{ JSON.stringify($('Aplicar validação resposta').first().json.responseMeta || {}) }}",
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
    name: 'Aplicar política resposta',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2220, 520],
    parameters: {
      jsCode: `const validated=$('Aplicar validação resposta').first().json||{};
const pol=$input.first().json||{};
const lookup=$('Aplicar cache lookup').first().json||{};
return [{json:{
  answer: String(pol.answer!=null?pol.answer:validated.answer||''),
  sources: Array.isArray(pol.sources)?pol.sources:(lookup.sources||[]),
  responseMeta: validated.responseMeta || pol.responseMeta || null,
  policyMeta: pol.policyMeta || null,
  auditAction: pol.auditAction || validated.auditAction || null,
  qualityScore: validated.qualityScore ?? null,
  qualityGrade: validated.qualityGrade ?? null,
}}];`,
    },
  });

  // Quality apply → Policy → Cache save path
  connC['Aplicar validação resposta'] = {
    main: [[{ node: 'IA - APLICAR POLÍTICA DE RESPOSTA', type: 'main', index: 0 }]],
  };
  connC['IA - APLICAR POLÍTICA DE RESPOSTA'] = {
    main: [[{ node: 'Aplicar política resposta', type: 'main', index: 0 }]],
  };
  connC['Aplicar política resposta'] = {
    main: [[{ node: 'IA - SALVAR CACHE', type: 'main', index: 0 }]],
  };

  // Patch Aplicar cache save to use policy answer/sources/policyMeta
  const aplicarSave = nodesC.find((n) => n.name === 'Aplicar cache save');
  if (aplicarSave) {
    aplicarSave.parameters.jsCode = `const openai=$('Message a model').first().json||{};
const lookup=$('Aplicar cache lookup').first().json||{};
const save=$input.first().json||{};
const validated=(()=>{try{return $('Aplicar validação resposta').first().json||{};}catch(_){return {};}})();
const policy=(()=>{try{return $('Aplicar política resposta').first().json||{};}catch(_){return {};}})();
const answer=String(policy.answer!=null&&policy.answer!==''?policy.answer:(validated.answer!=null&&validated.answer!==''?validated.answer:(openai.output?.[0]?.content?.[0]?.text ?? '')));
const prompt=$('Aplicar prompt carregado').first().json||{};
const sources=(Array.isArray(policy.sources)&&policy.sources.length?policy.sources:(lookup.sources||[])).map(s=>({...s, expirationDate:s.expirationDate??s.vigencyDate??null}));
const requestId=$('Normalizar request').first().json.requestId;
const cacheMeta={...(lookup.cacheMeta||{}), ...(save.cacheMeta||{}), answerFromCache:false};
const evidenceMeta=lookup.evidenceMeta||null;
const responseMeta=policy.responseMeta||validated.responseMeta||null;
const policyMeta=policy.policyMeta||null;
return [{json:{data:{question:lookup.question,answer,sources,classification:lookup.classification,retrievalMeta:lookup.retrievalMeta||null,contextMeta:lookup.contextMeta||null,cacheMeta,evidenceMeta,responseMeta,policyMeta,promptVersion:prompt.versionNumber||prompt.promptVersion||null,modelName:prompt.modelName||null},requestId,auditAction:policy.auditAction||validated.auditAction||null}}];`;
  }

  // Ensure SALVAR CACHE gets post-policy answer if it reads from openai - check inputs
  const salvar = nodesC.find((n) => n.name === 'IA - SALVAR CACHE');
  if (salvar?.parameters?.workflowInputs?.value) {
    const v = salvar.parameters.workflowInputs.value;
    if (v.answer !== undefined) {
      v.answer = "={{ $('Aplicar política resposta').first().json.answer || '' }}";
    }
    if (v.answerText !== undefined) {
      v.answerText = "={{ $('Aplicar política resposta').first().json.answer || '' }}";
    }
  }

  const consultaVid = await upsertWorkflow({
    id: CONSULTA,
    name: rows[0].name,
    nodes: nodesC,
    connections: connC,
    active: true,
    description: 'Etapa 25 wire Response Policy',
  });

  writeFileSync(
    new URL('./_e25-runtime.json', import.meta.url),
    JSON.stringify({ POLICY_ID, runtimeVid, consultaVid }, null, 2),
  );
}

await client.end();
console.log('done');
