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
const code = nodes.find((n) => n.name === 'Avaliar e montar insert').parameters.jsCode;
const i = code.indexOf('INSERT INTO');
writeFileSync(
  new URL('./_e21-avaliar-insert.txt', import.meta.url),
  code.slice(i, i + 1200) + '\n\n---RETURN---\n' + code.slice(code.lastIndexOf('return [{'), code.lastIndexOf('return [{') + 800),
);
console.log('has final_context_count col', /final_context_count/.test(code));
console.log('has retrieval_latency_ms col', /retrieval_latency_ms/.test(code));
console.log('return has finalContextCount', /finalContextCount/.test(code.slice(code.lastIndexOf('return [{'))));
await c.end();
