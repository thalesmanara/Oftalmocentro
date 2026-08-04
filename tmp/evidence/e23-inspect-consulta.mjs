#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(
  `SELECT n->>'name' AS name FROM workflow_entity w,
          LATERAL jsonb_array_elements(w.nodes::jsonb) n
    WHERE w.id='8EXk5RkFW5cxnenL' ORDER BY 1`,
);
console.log(r.rows.map((x) => x.name).join('\n'));
const conn = await c.query(`SELECT connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const co =
  typeof conn.rows[0].connections === 'string'
    ? JSON.parse(conn.rows[0].connections)
    : conn.rows[0].connections;
console.log('\nAplicar contexto recuperado ->', JSON.stringify(co['Aplicar contexto recuperado']));
console.log('Carregar prompt ativo ->', JSON.stringify(co['Carregar prompt ativo']));
console.log('Aplicar prompt carregado ->', JSON.stringify(co['Aplicar prompt carregado']));
await c.end();
