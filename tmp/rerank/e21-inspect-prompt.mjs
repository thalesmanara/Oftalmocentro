#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const names = ['Aplicar prompt carregado', 'Carregar prompt ativo', 'Message a model', 'Montar resposta', 'Aplicar contexto recuperado'];
const out = {};
for (const n of nodes) {
  if (names.includes(n.name)) {
    out[n.name] = {
      type: n.type,
      parameters: n.parameters,
    };
  }
}
writeFileSync(new URL('./_e21-prompt-nodes.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(Object.keys(out));
for (const [k, v] of Object.entries(out)) {
  const code = v.parameters?.jsCode || JSON.stringify(v.parameters).slice(0, 500);
  console.log('\n====', k, '====\n', String(code).slice(0, 800));
}
await c.end();
