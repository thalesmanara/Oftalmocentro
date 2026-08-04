#!/usr/bin/env node
/**
 * Etapa 25 — patch SALVAR CACHE sources from policy + ensure auditAction on success path
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function save(id, nodes, connections, name) {
  const versionId = randomUUID();
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa25',$3::json,$4::json,$5,'e25 patch2',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await c.query('COMMIT');
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [id]);
  console.log('saved', id, versionId);
}

const { rows } = await c.query(
  `SELECT name, nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const salvar = nodes.find((n) => n.name === 'IA - SALVAR CACHE');
const v = salvar.parameters.workflowInputs.value;
v.answer = "={{ $('Aplicar política resposta').first().json.answer || '' }}";
v.sourcesJson =
  "={{ JSON.stringify($('Aplicar política resposta').first().json.sources || []) }}";

const aplicarSave = nodes.find((n) => n.name === 'Aplicar cache save');
if (aplicarSave && !aplicarSave.parameters.jsCode.includes('auditAction')) {
  // already has auditAction in return
}
console.log('aplicarSave has auditAction', aplicarSave.parameters.jsCode.includes('auditAction'));

// Ensure Preparar sucesso receives auditAction if the field exists
const prep = nodes.find((n) => n.name === 'Preparar sucesso');
const prepVal = prep?.parameters?.workflowInputs?.value || {};
console.log('Preparar sucesso keys', Object.keys(prepVal));
if (prepVal.auditAction !== undefined || Object.keys(prepVal).includes('action')) {
  // leave
} else if (!prepVal.auditAction) {
  prep.parameters.workflowInputs.value = {
    ...prepVal,
    auditAction: "={{ $json.auditAction || '' }}",
  };
}

await save('8EXk5RkFW5cxnenL', nodes, connections, rows[0].name);
await c.end();
