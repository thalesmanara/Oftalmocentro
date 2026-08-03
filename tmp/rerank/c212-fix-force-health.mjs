#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
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
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

// 1) Preserve force explicitly in Após carregar config + throw early in Preparar entrada path via Montar
await bump('e95a92295d7c4deb', 'Preserve force flag through config load', (nodes) => {
  const apos = nodes.find((n) => n.name === 'Após carregar config');
  apos.parameters.jsCode = `const prep=$('Preparar entrada').first().json||{};
const cfg=$input.first().json||{};
const forceContextFailureForTest = prep.forceContextFailureForTest === true || prep.forceContextFailureForTest === 'true' || prep.labForceContextFailure === true;
if(!cfg.ok){
  return [{json:{...prep, configuration:{}, mode:'LEGACY', versionId:null, versionLabel:null, code:'AI_QUERY_CONTEXT', loadError:cfg.error||cfg.code||'missing', forceContextFailureForTest, labForceContextFailure: forceContextFailureForTest}}];
}
return [{json:{...prep, ...cfg, forceContextFailureForTest, labForceContextFailure: forceContextFailureForTest}}];`;

  const prep = nodes.find((n) => n.name === 'Preparar entrada');
  let pcode = prep.parameters.jsCode;
  if (!pcode.includes('labForceContextFailure')) {
    pcode = pcode.replace(
      'forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest===\'true\'),',
      `forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'),
  labForceContextFailure: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'),`,
    );
    prep.parameters.jsCode = pcode;
  }

  const montar = nodes.find((n) => n.name === 'Montar janela');
  let mcode = montar.parameters.jsCode;
  mcode = mcode.replace(
    /const forceContextFailureForTest = __forceSrc\.forceContextFailureForTest === true \|\| __forceSrc\.forceContextFailureForTest === 'true';/,
    `const forceContextFailureForTest = __forceSrc.forceContextFailureForTest === true || __forceSrc.forceContextFailureForTest === 'true' || __forceSrc.labForceContextFailure === true || inp.labForceContextFailure === true;`,
  );
  montar.parameters.jsCode = mcode;
});

// 2) Consulta: return string 'true'/'false' for force input reliability
await bump('8EXk5RkFW5cxnenL', 'Force flag string for CWM input', (nodes) => {
  const cwm = nodes.find((n) => n.name === 'IA - GERENCIAR JANELA DE CONTEXTO');
  cwm.parameters.workflowInputs.value.forceContextFailureForTest = `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.forceContextFailureForTest===true||b.forceContextFailureForTest==='true'||q.forceContextFailureForTest===true||q.forceContextFailureForTest==='true';
  if(!flag) return 'false';
  let allowed=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const user=auth.user||{};
    const perms=[...(Array.isArray(auth.permissions)?auth.permissions:[]),...(Array.isArray(user.permissions)?user.permissions:[])].map(p=>String(p).toLowerCase());
    allowed=auth.isMaster===true||user.isMaster===true||perms.includes('editar_configuracoes');
  } catch(_) {}
  const overrideFlag=b.contextConfigOverrideAllowed===true||b.contextConfigOverrideAllowed==='true';
  return (allowed && overrideFlag) ? 'true' : 'false';
})() }}`;
});

// 3) Health: load published context from DB - find SQL probe node or inject into Aggregate
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  // Find where partial is built
  for (const n of nodes) {
    if (n.parameters?.jsCode && /contextWindow|_partial|Finalize storage/i.test(n.parameters.jsCode + n.name)) {
      console.log('health node', n.name, n.parameters.jsCode.length);
    }
    if (n.parameters?.query && /ai_context|retrieval_active/i.test(n.parameters.query)) {
      console.log('health sql', n.name);
      writeFileSync(new URL(`./_c212-hsql-${n.name.replace(/\\W+/g, '_')}.sql`, import.meta.url), n.parameters.query);
    }
  }
}

await client.end();
