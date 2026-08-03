#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const inserir = nodes.find((n) => n.name === 'Inserir run');
const q = inserir.parameters.query || '';
writeFileSync(new URL('./_c211-inserir-run.sql', import.meta.url), q);
console.log({
  hasContextCol: q.includes('context_config_version_id'),
  hasReturningBotch: q.includes('RETURNING$1'),
  len: q.length,
  tail: q.slice(-400),
});
await client.end();
