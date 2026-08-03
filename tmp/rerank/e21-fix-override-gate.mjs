#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Fix Consulta gate
const CONSULTA = '8EXk5RkFW5cxnenL';
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [CONSULTA],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const call = nodes.find((n) => n.name === 'IA - RECUPERAR CONTEXTO');
  call.parameters.workflowInputs.value.modeOverrideAllowed = `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.modeOverrideAllowed===true||b.modeOverrideAllowed==='true'||q.modeOverrideAllowed===true||q.modeOverrideAllowed==='true';
  let isAdmin=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const role=String(auth.role||auth.userRole||auth.perfil||'').toUpperCase();
    const perms=auth.permissions||auth.permissoes||[];
    isAdmin=role==='ADMIN'||role==='ADMINISTRADOR'||role==='SYSTEM'||(Array.isArray(perms)&&perms.some(p=>String(p).toUpperCase().includes('AI_RETRIEVAL')||String(p).toUpperCase().includes('ADMIN')));
  } catch(_) {}
  return flag && isAdmin ? 'true' : 'false';
})() }}`;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
    JSON.stringify(nodes),
    CONSULTA,
  ]);
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), CONSULTA, rows[0].activeVersionId],
  );
  console.log('Consulta override gated');
}

// Fix RECUPERAR Preparar entrada — do not infer override from versionId alone
const REC = 'bae8872eeb164a27';
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [REC],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const prep = nodes.find((n) => n.name === 'Preparar entrada');
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    "const modeOverrideAllowed=t.modeOverrideAllowed===true||t.modeOverrideAllowed==='true'||!!retrievalConfigVersionId;",
    "const modeOverrideAllowed=t.modeOverrideAllowed===true||t.modeOverrideAllowed==='true';",
  );
  // also fix versionId line if present
  prep.parameters.jsCode = prep.parameters.jsCode.replace(
    'versionId: modeOverrideAllowed ? retrievalConfigVersionId : \'\',',
    "versionId: (modeOverrideAllowed && retrievalConfigVersionId) ? retrievalConfigVersionId : '',",
  );
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
    JSON.stringify(nodes),
    REC,
  ]);
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), REC, rows[0].activeVersionId],
  );
  console.log('RECUPERAR override inference fixed', {
    hasLoose: prep.parameters.jsCode.includes('||!!retrievalConfigVersionId'),
  });
}

await client.end();
