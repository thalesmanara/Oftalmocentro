#!/usr/bin/env node
/**
 * Extract CWM conflict block and tighten false positives.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => /Montar janela|montar|janela/i.test(x.name));
console.log('node', n?.name);
writeFileSync(new URL('./_c211-cwm-montar.js', import.meta.url), n.parameters.jsCode);
const code = n.parameters.jsCode;
const i = code.indexOf('conflict');
console.log('first conflict idx', i);
const matches = [...code.matchAll(/conflict[A-Za-z]*/g)].slice(0, 40);
console.log([...new Set(matches.map((m) => m[0]))]);
const block = code.match(/NO_CONFLICT[\s\S]{0,2500}/);
console.log(block ? block[0].slice(0, 2000) : 'no NO_CONFLICT');
await client.end();
