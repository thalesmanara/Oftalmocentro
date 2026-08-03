import pg from 'pg';
import fs from 'fs';
import path from 'path';

const client = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const map = {
  GERAR: 'D1bbCBEdKuNQc9F5',
  VALIDAR: 'Feli8ssd2KggST6N',
  ORQUESTRAR: 'LJQZ2HrG6qJGN0Q2',
  REPROCESSAR: 'x4bw9IQ5vwJSFh0y',
  FILA: '3BkmtrasXs1lORtL',
  SCHEDULE: 'HympisbYzMo0mQYP',
  WEBHOOK_REPROCESS: 'A3ps15dPHWoN2LZf',
};

const outDir = path.join('tmp', 'embeddings');
const ids = {};

for (const [key, id] of Object.entries(map)) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections, settings, meta, "activeVersionId"
     FROM workflow_entity WHERE id = $1`,
    [id]
  );
  if (!rows[0]) {
    console.warn('missing', key, id);
    continue;
  }
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const settings =
    typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : rows[0].settings;
  const meta = typeof rows[0].meta === 'string' ? JSON.parse(rows[0].meta) : rows[0].meta;
  const fileBase = {
    GERAR: 'embedding-gerar',
    VALIDAR: 'embedding-validar',
    ORQUESTRAR: 'embedding-orquestrar',
    REPROCESSAR: 'embedding-reprocessar',
    FILA: 'embedding-fila',
    SCHEDULE: 'schedule-embeddings-fila',
    WEBHOOK_REPROCESS: 'post-system-embeddings-reprocess',
  }[key];
  const payload = {
    name: rows[0].name,
    nodes,
    connections,
    settings: settings || {},
    meta: meta || {},
  };
  const file = path.join(outDir, `${fileBase}.workflow.js`);
  fs.writeFileSync(
    file,
    `// Exported from n8n workflow ${id} (${rows[0].name})\n` +
      `// activeVersionId=${rows[0].activeVersionId}\n` +
      `export default ${JSON.stringify(payload, null, 2)};\n`
  );
  ids[key] = id;
  console.log('wrote', file);
}

fs.writeFileSync(path.join(outDir, 'workflow-ids.json'), JSON.stringify(ids, null, 2) + '\n');
console.log('wrote workflow-ids.json', ids);
await client.end();
