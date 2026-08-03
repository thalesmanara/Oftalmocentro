#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

for (const [id, names] of [
  ['KdpEmEGHNlPICOa4', ['Chamar Consulta IA', 'Trigger', 'Avaliar e montar insert', 'Inserir resultado']],
  ['12t0Ol6zWQJgAKPC', ['Inserir run', 'Montar filtro de casos', 'Executar caso', 'Calcular métricas', 'Trigger']],
  ['8EXk5RkFW5cxnenL', ['Montar resposta', 'Montar contexto', 'Carregar retrieval config', 'Preparar seleção retrieval']],
  ['sClDEVNVS0TGG2uq', null],
]) {
  const { rows } = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    if (names && !names.includes(n.name)) continue;
    const payload = {
      name: n.name,
      type: n.type,
      params: {
        ...n.parameters,
        jsCode: n.parameters?.jsCode ? n.parameters.jsCode.slice(0, 2500) : undefined,
        query: n.parameters?.query ? n.parameters.query.slice(0, 1500) : undefined,
        workflowInputs: n.parameters?.workflowInputs,
        url: n.parameters?.url,
        jsonBody: n.parameters?.jsonBody || n.parameters?.body,
      },
    };
    writeFileSync(
      new URL(`./_dump-${id}-${n.name.replace(/[^\w]+/g, '_')}.json`, import.meta.url),
      JSON.stringify(payload, null, 2),
    );
    console.log('wrote', id, n.name);
  }
}
await client.end();
