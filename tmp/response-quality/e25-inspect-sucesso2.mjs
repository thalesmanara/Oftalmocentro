#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT nodes FROM workflow_entity WHERE id='zE5LRjZfbXw8Ymll'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const prep = nodes.find((n) => n.name === 'Preparar sucesso');
console.log(prep.parameters.jsCode);

// find audit workflow usage in Consulta
const { rows: cRows } = await c.query(
  `SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const cNodes = typeof cRows[0].nodes === 'string' ? JSON.parse(cRows[0].nodes) : cRows[0].nodes;
const auditish = cNodes.filter(
  (n) =>
    /audit/i.test(n.name) ||
    String(n.parameters?.jsCode || '').includes('audit') ||
    String(JSON.stringify(n.parameters || {})).includes('AUDIT'),
);
console.log(
  '\nauditish nodes',
  auditish.map((n) => n.name),
);

const conn =
  typeof cRows[0].connections === 'string'
    ? JSON.parse(cRows[0].connections)
    : cRows[0].connections;
console.log('after Aplicar cache save', conn['Aplicar cache save']);
console.log('after Preparar sucesso', conn['Preparar sucesso']);

await c.end();
