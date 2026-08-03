#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

writeFileSync(new URL('./_consulta-connections.json', import.meta.url), JSON.stringify(connections, null, 2));

// Find path around CWM and OpenAI
const interesting = [
  'Aplicar janela de contexto',
  'IA - GERENCIAR JANELA DE CONTEXTO',
  'Message a model',
  'Montar resposta',
  'Classificar pergunta',
  'Aplicar contexto recuperado',
  'Carregar prompt ativo',
];
for (const name of interesting) {
  const outs = connections[name];
  console.log('\nFROM', name, '→', JSON.stringify(outs)?.slice(0, 400));
}

// Message a model params
const msg = nodes.find((n) => n.name === 'Message a model');
console.log('\nMessage type', msg?.type, 'params keys', Object.keys(msg?.parameters || {}));
writeFileSync(new URL('./_consulta-message.json', import.meta.url), JSON.stringify(msg, null, 2));

const montar = nodes.find((n) => n.name === 'Montar resposta');
writeFileSync(new URL('./_consulta-montar.js', import.meta.url), montar?.parameters?.jsCode || '');
console.log('\nMontar resposta starts:\n', (montar?.parameters?.jsCode || '').slice(0, 600));

await client.end();
