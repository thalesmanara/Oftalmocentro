#!/usr/bin/env node
/**
 * Etapa 25 — dump current SALVAR + audit after cache patch; peek Preparar sucesso
 */
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const salvar = nodes.find((n) => n.name === 'IA - SALVAR CACHE');
const v = salvar.parameters.workflowInputs.value;
console.log('answer', v.answer);
console.log('sourcesJson', v.sourcesJson);
const prep = nodes.find((n) => n.name === 'Preparar sucesso');
console.log('prep keys', Object.keys(prep.parameters.workflowInputs.value));
const audit = nodes.find((n) => n.name === 'Registrar auditoria sucesso');
console.log('audit action', audit.parameters.workflowInputs.value.action);

await c.end();
