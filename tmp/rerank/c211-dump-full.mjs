#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const trigger = nodes.find((n) => n.name === 'Trigger');
const call = nodes.find((n) => n.name === 'Chamar Consulta IA');
const carregar = nodes.find((n) => n.name === 'Carregar caso');
writeFileSync(
  new URL('./_c211-exec-teste-full.json', import.meta.url),
  JSON.stringify(
    {
      trigger: trigger?.parameters,
      call: call?.parameters,
      carregarQuery: carregar?.parameters?.query,
    },
    null,
    2,
  ),
);

const ds = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const dnodes = typeof ds.rows[0].nodes === 'string' ? JSON.parse(ds.rows[0].nodes) : ds.rows[0].nodes;
const dTrigger = dnodes.find((n) => n.name === 'Trigger');
const execCaso = dnodes.find((n) => n.name === 'Executar caso');
const inserirRun = dnodes.find((n) => n.name === 'Inserir run');
writeFileSync(
  new URL('./_c211-exec-dataset-full.json', import.meta.url),
  JSON.stringify(
    {
      trigger: dTrigger?.parameters,
      execCaso: execCaso?.parameters,
      inserirRun: {
        type: inserirRun?.type,
        query: inserirRun?.parameters?.query?.slice(0, 1500),
        js: inserirRun?.parameters?.jsCode?.slice(0, 1500),
      },
    },
    null,
    2,
  ),
);

const rd = await client.query(`SELECT nodes FROM workflow_entity WHERE id='wTH2YV6pIlhzWDiY'`);
const rdnodes = typeof rd.rows[0].nodes === 'string' ? JSON.parse(rd.rows[0].nodes) : rd.rows[0].nodes;
const execDs = rdnodes.find((n) => n.name === 'Executar dataset');
const restaurar = rdnodes.find((n) => n.name === 'Restaurar request');
writeFileSync(
  new URL('./_c211-run-dataset-full.json', import.meta.url),
  JSON.stringify({ execDs: execDs?.parameters, restaurarJs: restaurar?.parameters?.jsCode?.slice(0, 1200) }, null, 2),
);

console.log('written');
await client.end();
