#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const dir = new URL('./_e21_dump/', import.meta.url);
mkdirSync(dir, { recursive: true });

async function dumpWf(id, names) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const out = { name: rows[0].name, connections, nodes: {} };
  for (const n of nodes) {
    if (names && !names.includes(n.name)) continue;
    out.nodes[n.name] = {
      type: n.type,
      typeVersion: n.typeVersion,
      position: n.position,
      credentials: n.credentials || null,
      parameters: n.parameters,
      onError: n.onError,
      alwaysOutputData: n.alwaysOutputData,
    };
  }
  writeFileSync(new URL(`${id}.json`, dir), JSON.stringify(out, null, 2));
  return { nodes, connections, allNames: nodes.map((n) => n.name) };
}

const consulta = await dumpWf('8EXk5RkFW5cxnenL', null);
await dumpWf('YDnrXjzYUOrZVE6N', null);
await dumpWf('sClDEVNVS0TGG2uq', null);
await dumpWf('nivEQHAqHWIwP8P8', null);

// Also dump executeWorkflow input mappings for key calls
const callNodes = consulta.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow');
const calls = callNodes.map((n) => ({
  name: n.name,
  workflowId: n.parameters?.workflowId,
  inputs: n.parameters?.workflowInputs,
}));
writeFileSync(new URL('./_e21-calls.json', import.meta.url), JSON.stringify(calls, null, 2));

console.log(
  JSON.stringify(
    {
      consultaNodes: consulta.allNames.length,
      calls: calls.map((c) => ({ name: c.name, wf: c.workflowId?.value || c.workflowId })),
      sizes: Object.fromEntries(
        [
          'Buscar chunks relevantes',
          'Merge híbrido',
          'Montar contexto',
          'Preparar seleção retrieval',
          'Resolver ranking final',
          'Corte hybrid padrão',
          'Montar resposta',
          'Busca vetorial Qdrant',
          'Preparar embedding pergunta',
          'Extrair vetor pergunta',
        ].map((name) => {
          const n = consulta.nodes.find((x) => x.name === name);
          return [name, n?.parameters?.jsCode?.length || n?.parameters?.query?.length || 0];
        }),
      ),
    },
    null,
    2,
  ),
);
await client.end();
