#!/usr/bin/env node
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
console.log(JSON.stringify(salvar.parameters, null, 2).slice(0, 4000));

const applyPol = nodes.find((n) => n.name === 'Aplicar política resposta');
console.log('\n--- Aplicar política (first 1500) ---\n', String(applyPol?.parameters?.jsCode || '').slice(0, 1500));

const prepare = nodes.find((n) => n.name === 'Preparar sucesso');
console.log('\n--- Preparar sucesso has policyMeta ---', String(prepare?.parameters?.jsCode || '').includes('policyMeta'));

await c.end();
