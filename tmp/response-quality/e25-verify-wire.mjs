#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT id, name, active FROM workflow_entity WHERE id = ANY($1::text[])`,
  [['8EXk5RkFW5cxnenL', 'c25ResponsePolicy01', 'c24ResponseQuality01']],
);
console.log('workflows', rows);

const { rows: w } = await c.query(
  `SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof w[0].nodes === 'string' ? JSON.parse(w[0].nodes) : w[0].nodes;
const conn =
  typeof w[0].connections === 'string' ? JSON.parse(w[0].connections) : w[0].connections;
const names = nodes.map((x) => x.name);
console.log(
  'policy-related nodes:',
  names.filter((x) => /polit|quality|cache|OpenAI|validar|aplicar|salvar/i.test(x)),
);
const keys = [
  'Aplicar validação resposta',
  'IA - APLICAR POLÍTICA DE RESPOSTA',
  'Aplicar política resposta',
  'IA - SALVAR CACHE',
  'Aplicar cache save',
];
for (const k of keys) {
  console.log(k, '->', (conn[k]?.main?.[0] || []).map((x) => x.node));
}

const salvar = nodes.find((n) => n.name === 'IA - SALVAR CACHE');
const inputs = salvar?.parameters?.workflowInputs || salvar?.parameters || {};
console.log('SALVAR CACHE answer expr snippet:', String(inputs.answer || inputs.values?.answer || '').slice(0, 200));

const applyCache = nodes.find((n) => n.name === 'Aplicar cache save');
console.log('Aplicar cache save has policyMeta:', String(applyCache?.parameters?.jsCode || '').includes('policyMeta'));

const { rows: cfg } = await c.query(
  `SELECT version_label, status, configuration->'responsePolicy'->>'enabled' AS policy_enabled
   FROM ai_response_quality_config_versions ORDER BY created_at`,
);
console.log('RQ versions', cfg);

await c.end();
