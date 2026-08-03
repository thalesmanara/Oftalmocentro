#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const names = nodes.map((n) => n.name);
const avaliar = nodes.find((n) => /Avaliar|montar insert/i.test(n.name));
const chamar = nodes.find((n) => /Chamar Consulta|Consulta IA/i.test(n.name));
const extrair = nodes.find((n) => /Extrair|Normalizar resposta|Mapear/i.test(n.name));

writeFileSync(
  new URL('./_e21-avaliar-dump.json', import.meta.url),
  JSON.stringify(
    {
      names,
      avaliarName: avaliar?.name,
      avaliarCode: avaliar?.parameters?.jsCode || null,
      related: nodes
        .filter((n) => /rank|retrieval|meta|métric|metric|insert|consulta/i.test(n.name))
        .map((n) => ({
          name: n.name,
          type: n.type,
          snippet: (n.parameters?.jsCode || JSON.stringify(n.parameters || {})).slice(0, 600),
        })),
    },
    null,
    2,
  ),
);
console.log(names.join('\n'));
await client.end();
