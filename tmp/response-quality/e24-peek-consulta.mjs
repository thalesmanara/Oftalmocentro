#!/usr/bin/env node
/**
 * Dump relevant Consulta IA node snippets for Etapa 24 wiring.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const conn = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const names = [
  'Message a model',
  'IA - SALVAR CACHE',
  'Aplicar cache save',
  'Montar resposta cache',
  'Aplicar cache lookup',
  'Cache serve?',
];
const dump = {};
for (const name of names) {
  const n = nodes.find((x) => x.name === name);
  dump[name] = n
    ? {
        type: n.type,
        jsCode: n.parameters?.jsCode?.slice(0, 2500) || null,
        workflowInputs: n.parameters?.workflowInputs || null,
        outs: conn[name] || null,
      }
    : null;
}
console.log('Message outs', JSON.stringify(conn['Message a model']));
console.log('SALVAR outs', JSON.stringify(conn['IA - SALVAR CACHE']));
console.log('save code head:\n', dump['Aplicar cache save']?.jsCode?.slice(0, 1200));
console.log('cache mount head:\n', dump['Montar resposta cache']?.jsCode?.slice(0, 800));
writeFileSync(new URL('./_e24-consulta-snip.json', import.meta.url), JSON.stringify(dump, null, 2));
await c.end();
