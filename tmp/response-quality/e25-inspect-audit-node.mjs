#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const conn =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const audit = nodes.find((n) => n.name === 'Registrar auditoria sucesso');
console.log(JSON.stringify(audit.parameters, null, 2).slice(0, 3500));
console.log('\nconnections into audit:', Object.entries(conn).filter(([, v]) =>
  JSON.stringify(v).includes('Registrar auditoria sucesso'),
).map(([k]) => k));
console.log('audit outs', conn['Registrar auditoria sucesso']);

await c.end();
