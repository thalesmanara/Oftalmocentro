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

const chain = [
  'Message a model',
  'IA - VALIDAR RESPOSTA',
  'Aplicar validação resposta',
  'IA - SALVAR CACHE',
  'Aplicar cache save',
  'Preparar sucesso',
];
for (const n of chain) {
  console.log(n, '->', JSON.stringify(conn[n]?.main?.[0]?.map((x) => x.node)));
}

const save = nodes.find((n) => n.name === 'Aplicar cache save');
console.log('\nSAVE CODE:\n', save?.parameters?.jsCode);

const cfg = await c.query(
  `SELECT version_label, status, mode, configuration
   FROM ai_response_quality_config_versions
   ORDER BY version_number`,
);
for (const r of cfg.rows) {
  const conf = typeof r.configuration === 'string' ? JSON.parse(r.configuration) : r.configuration;
  console.log('\n', r.version_label, r.status, r.mode, 'keys', Object.keys(conf || {}));
  console.log('  has responsePolicy', !!conf?.responsePolicy);
}

await c.end();
