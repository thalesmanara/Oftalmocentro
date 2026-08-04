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

for (const name of ['Preparar sucesso', 'Registrar auditoria', 'Responder sucesso', 'Montar resposta']) {
  const n = nodes.find((x) => x.name === name);
  if (!n) {
    console.log('missing', name);
    continue;
  }
  const code = n.parameters?.jsCode || JSON.stringify(n.parameters || {}).slice(0, 800);
  console.log('\n===', name, '===');
  console.log(String(code).slice(0, 1200));
}

// migration columns
const cols = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name IN ('ai_test_results','ai_test_metrics')
    AND column_name LIKE 'response_policy%'
  ORDER BY table_name, column_name`);
console.log('\npolicy cols', cols.rows.map((r) => r.column_name));

await c.end();
