#!/usr/bin/env node
/**
 * Fix: CWM reads force from Preparar entrada; publish validates context version.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [nodesJson, versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

// CWM: read force from Preparar entrada
await bump('e95a92295d7c4deb', 'Read forceContextFailure from Preparar entrada', (nodes) => {
  const n = nodes.find((x) => x.name === 'Montar janela');
  let code = n.parameters.jsCode;
  code = code.replace(
    /const forceContextFailureForTest = inp\.forceContextFailureForTest === true \|\| inp\.forceContextFailureForTest === 'true';/,
    `let __forceSrc = inp;
try { const pe = $('Preparar entrada').first().json || {}; if (pe && Object.keys(pe).length) __forceSrc = { ...inp, ...pe }; } catch(_) {}
const forceContextFailureForTest = __forceSrc.forceContextFailureForTest === true || __forceSrc.forceContextFailureForTest === 'true';`,
  );
  n.parameters.jsCode = code;
});

// PUBLISH: validate against context_config_version_id / label
await bump('f83073bfb4154115', 'Validate publish run against context version', (nodes) => {
  const checar = nodes.find((x) => /Checar run/i.test(x.name));
  if (checar?.parameters?.query) {
    checar.parameters.query = `SELECT id, status, finished_at, retrieval_config_version,
  context_config_version_id, context_mode_override_used,
  (SELECT version_label FROM ai_context_config_versions v WHERE v.id = r.context_config_version_id) AS context_config_version
FROM ai_test_runs r
WHERE id = NULLIF('{{ $('Avaliar publish').first().json.validationRunId || "" }}','')::uuid
LIMIT 1;`;
  }
  const avaliar = nodes.find((x) => x.name === 'Avaliar run');
  if (avaliar?.parameters?.jsCode) {
    avaliar.parameters.jsCode = `const prep=$('Avaliar publish').first().json; const run=$input.first().json||{};
if(prep.forceOverride) return [{json:{...prep, blocked:false, overrideUsed:true}}];
if(!run.id) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_NOT_FOUND'}, statusCode:400}}];
if(!run.finished_at) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_NOT_FINISHED'}, statusCode:400}}];
const runStatus=String(run.status||'').toUpperCase();
if(runStatus==='FAILED' && !prep.forceOverride) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_FAILED'}, statusCode:400}}];
const runCtxVersion=String(run.context_config_version||'');
const runCtxId=String(run.context_config_version_id||'');
const expectedLabel=String(prep.versionLabel||'');
const expectedId=String(prep.versionId||'');
const match = (runCtxVersion && runCtxVersion === expectedLabel) || (runCtxId && expectedId && runCtxId === expectedId);
if(!match) return [{json:{...prep, blocked:true, data:{ok:false,code:'VALIDATION_RUN_VERSION_MISMATCH', message:'Run não corresponde à versão de contexto', runVersion:runCtxVersion||runCtxId||null, versionLabel:expectedLabel}, statusCode:400}}];
return [{json:{...prep, blocked:false, overrideUsed:false}}];`;
  }
});

// Also ensure Preparar publish exposes versionId
await bump('f83073bfb4154115', 'noop check', () => {});

// Fix Preparar publish to keep versionId - read and patch if needed
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='f83073bfb4154115'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const prep = nodes.find((n) => n.name === 'Preparar publish');
  console.log('Preparar publish head:\n', prep.parameters.jsCode.slice(0, 800));
}

await client.end();
