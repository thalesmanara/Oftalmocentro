#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const ID = '8EXk5RkFW5cxnenL';
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [ID],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const call = nodes.find((n) => n.name === 'IA - RECUPERAR CONTEXTO');
call.parameters.workflowInputs.value.modeOverrideAllowed = `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.modeOverrideAllowed===true||b.modeOverrideAllowed==='true'||q.modeOverrideAllowed===true||q.modeOverrideAllowed==='true';
  if(!flag) return 'false';
  let allowed=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const user=auth.user||{};
    const perms=[...(Array.isArray(auth.permissions)?auth.permissions:[]),...(Array.isArray(user.permissions)?user.permissions:[])].map(p=>String(p).toLowerCase());
    allowed=auth.isMaster===true||user.isMaster===true||perms.includes('editar_configuracoes')||perms.some(p=>p.includes('ai_retrieval')||p.includes('admin'));
  } catch(_) {}
  return allowed ? 'true' : 'false';
})() }}`;

await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(nodes),
  ID,
]);
await client.query(
  `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
  [JSON.stringify(nodes), ID, rows[0].activeVersionId],
);
console.log('gate updated for editar_configuracoes / isMaster');
await client.end();
