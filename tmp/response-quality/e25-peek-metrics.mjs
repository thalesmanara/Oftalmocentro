#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT nodes FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.name === 'Agregar métricas');
const code = n.parameters.jsCode;
writeFileSync(new URL('./_e25-metrics-raw.js', import.meta.url), code);
const i = code.indexOf('source_precision');
console.log(JSON.stringify(code.slice(i, i + 250)));
const j = code.indexOf('source_recall = EXCLUDED');
console.log('conflict upd', JSON.stringify(code.slice(j, j + 120)));
const k = code.indexOf('agg.sourcePrecision');
console.log('values', JSON.stringify(code.slice(k, k + 180)));
await c.end();
