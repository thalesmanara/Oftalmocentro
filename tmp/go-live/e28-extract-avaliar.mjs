#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const node = nodes.find((n) => /Avaliar e montar insert/i.test(n.name));
if (!node) {
  console.log('node names', nodes.map((n) => n.name));
  process.exit(1);
}
const code = node.parameters?.jsCode || node.parameters?.jsCode || '';
writeFileSync(new URL('./_avaliar-code.js', import.meta.url), code);
console.log('len', code.length, 'lines', code.split('\n').length);
// find broken lines around insufficient_context
const lines = code.split('\n');
for (let i = 120; i < Math.min(160, lines.length); i++) {
  console.log(String(i + 1).padStart(4), JSON.stringify(lines[i]));
}
await c.end();
